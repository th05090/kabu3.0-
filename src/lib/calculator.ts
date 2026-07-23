import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export async function calculateAndPopulateStocks() {
  console.log('--- Starting Metrics Calculation ---');

  try {
    // 1. stocksテーブルをクリア
    await db.execute('DELETE FROM stocks');

    // 2. equities_master と daily_quotes を結合し、各銘柄の最新指標を計算する
    // SQLiteのウィンドウ関数を利用して、過去N日分のデータを集計します。
    // ※本番環境（数千銘柄×数百日）ではSQLiteの計算負荷に注意が必要ですが、まずはSQLで一括算出します。
    
    // SQLite 3.25.0+ はウィンドウ関数 (OVER, PARTITION BY) をサポートしています。
    const query = `
      WITH RankedQuotes AS (
        SELECT 
          ticker,
          date,
          adj_close,
          adj_high,
          adj_volume,
          turnover,
          ROW_NUMBER() OVER(PARTITION BY ticker ORDER BY date DESC) as rn
        FROM daily_quotes
      ),
      LatestFinancialsRaw AS (
        SELECT
          ticker,
          net_sales,
          operating_profit,
          profit,
          equity_to_asset_ratio,
          shares_outstanding,
          forecast_net_sales,
          forecast_operating_profit,
          forecast_profit,
          forecast_dividend,
          eps,
          adj_eps,
          adj_dividend,
          adj_shares_outstanding,
          date,
          ROW_NUMBER() OVER(PARTITION BY ticker ORDER BY date DESC) as rn
        FROM financials
      ),
      LatestFinancials AS (
        SELECT 
          f1.*,
          (
            SELECT date 
            FROM financials f2 
            WHERE f2.ticker = f1.ticker 
              AND f2.date < f1.date 
              AND f2.date >= date(f1.date, '-15 months') 
            ORDER BY net_sales DESC 
            LIMIT 1
          ) as prev_fy_date
        FROM LatestFinancialsRaw f1 WHERE f1.rn = 1
      ),
      Metrics AS (
        SELECT 
          ticker,
          -- 最新の株価
          MAX(CASE WHEN rn = 1 THEN adj_close END) as current_price,
          -- SMA 25 (直近25日間の平均)
          AVG(CASE WHEN rn <= 25 THEN adj_close END) as sma_25,
          -- SMA 75
          AVG(CASE WHEN rn <= 75 THEN adj_close END) as sma_75,
          -- SMA 200
          AVG(CASE WHEN rn <= 200 THEN adj_close END) as sma_200,
          -- 前日の SMA 25 (ゴールデンクロス用)
          AVG(CASE WHEN rn BETWEEN 2 AND 26 THEN adj_close END) as prev_sma_25,
          -- 前日の SMA 75 (ゴールデンクロス用)
          AVG(CASE WHEN rn BETWEEN 2 AND 76 THEN adj_close END) as prev_sma_75,
          -- 52週高値 (直近250日の最大値)
          MAX(CASE WHEN rn <= 250 THEN adj_high END) as high_52w,
          -- 5日平均出来高
          AVG(CASE WHEN rn <= 5 THEN adj_volume END) as avg_volume_5d,
          -- 5日平均売買代金
          AVG(CASE WHEN rn <= 5 THEN turnover END) as avg_turnover_5d
        FROM RankedQuotes
        GROUP BY ticker
      )
      
      INSERT INTO stocks (
        ticker, name, market, industry, current_price,
        sma_25, is_above_sma_25, sma_25_deviation_pct,
        is_above_sma_75,
        is_above_sma_200,
        is_golden_cross,
        high_52w, high_52w_deviation, distance_to_high_52w_pct,
        avg_trading_value_5d, is_perfect_order,
        market_cap, operating_margin_pct, equity_ratio_pct, dividend_yield_pct, 
        revenue_growth_pct, operating_profit_growth_pct, eps_growth_pct
      )
      SELECT 
        m.ticker,
        m.name,
        m.market,
        m.industry,
        met.current_price,
        
        met.sma_25,
        (met.current_price > met.sma_25) as is_above_sma_25,
        ((met.current_price - met.sma_25) / met.sma_25 * 100) as sma_25_deviation_pct,
        
        (met.current_price > met.sma_75) as is_above_sma_75,
        
        (met.current_price > met.sma_200) as is_above_sma_200,
        
        -- ゴールデンクロス判定 (今日は25>75だが、前日は25<=75だった)
        (met.sma_25 > met.sma_75 AND met.prev_sma_25 <= met.prev_sma_75) as is_golden_cross,
        
        met.high_52w,
        (met.current_price - met.high_52w) as high_52w_deviation,
        ((met.current_price - met.high_52w) / met.high_52w * 100) as distance_to_high_52w_pct,
        
        (met.avg_turnover_5d / 100000000) as avg_trading_value_5d, -- 億円単位
        
        -- パーフェクトオーダー判定 (価格 > 25 > 75 > 200)
        (met.current_price > met.sma_25 AND met.sma_25 > met.sma_75 AND met.sma_75 > met.sma_200) as is_perfect_order,

        -- 財務指標 (Financials)
        -- 時価総額 (億円) = 最新株価 * 調整後発行済株式数
        (met.current_price * fin.adj_shares_outstanding / 100000000) as market_cap,
        -- 営業利益率 (%)
        (fin.operating_profit / NULLIF(fin.net_sales, 0) * 100) as operating_margin_pct,
        -- 自己資本比率 (%) (APIが少数の場合、*100)
        (fin.equity_to_asset_ratio * 100) as equity_ratio_pct,
        -- 配当利回り (%) = 調整後予想配当 / 最新株価
        (fin.adj_dividend / NULLIF(met.current_price, 0) * 100) as dividend_yield_pct,
        
        -- 成長率: 今期予想 / 前期の本決算実績(過去15ヶ月間で最大売上を記録したレコード) - 1
        -- 前期が0以下の場合は数学的に無意味・逆転現象が起きるため NULL とする
        CASE WHEN prev_fin.net_sales > 0 THEN (fin.forecast_net_sales / prev_fin.net_sales * 100 - 100) ELSE NULL END as revenue_growth_pct,
        CASE WHEN prev_fin.operating_profit > 0 THEN (fin.forecast_operating_profit / prev_fin.operating_profit * 100 - 100) ELSE NULL END as operating_profit_growth_pct,
        CASE WHEN prev_fin.profit > 0 THEN (fin.forecast_profit / prev_fin.profit * 100 - 100) ELSE NULL END as eps_growth_pct

      FROM equities_master m
      LEFT JOIN Metrics met ON m.ticker = met.ticker
      LEFT JOIN LatestFinancials fin ON m.ticker = fin.ticker
      LEFT JOIN financials prev_fin ON prev_fin.ticker = fin.ticker AND prev_fin.date = fin.prev_fy_date
      WHERE met.current_price IS NOT NULL;
    `;

    console.log('[Calculator] Executing aggregation query...');
    await db.execute(query);
    console.log('[Calculator] Successfully populated stocks table.');
    
    return { success: true };
  } catch (error) {
    console.error('Calculation Failed:', error);
    return { success: false, error };
  }
}
