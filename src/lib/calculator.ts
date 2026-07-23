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
      WITH RankedQuotesRaw AS (
        SELECT 
          ticker,
          date,
          adj_close,
          adj_high,
          adj_volume,
          turnover,
          LAG(adj_close, 1) OVER (PARTITION BY ticker ORDER BY date ASC) as prev_adj_close,
          ROW_NUMBER() OVER(PARTITION BY ticker ORDER BY date DESC) as rn
        FROM daily_quotes
      ),
      prev_sma_75 AS (
        SELECT ticker, date, AVG(adj_close) OVER (PARTITION BY ticker ORDER BY date ROWS BETWEEN 75 PRECEDING AND 1 PRECEDING) as sma
        FROM RankedQuotesRaw WHERE rn <= 76
      ),
      prev_sma_200 AS (
        SELECT ticker, date, AVG(adj_close) OVER (PARTITION BY ticker ORDER BY date ROWS BETWEEN 200 PRECEDING AND 1 PRECEDING) as sma
        FROM RankedQuotesRaw WHERE rn <= 201
      ),
      RankedQuotes AS (
        SELECT *,
          MAX(adj_close - prev_adj_close, 0) as gain,
          ABS(MIN(adj_close - prev_adj_close, 0)) as loss
        FROM RankedQuotesRaw
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
          -- 最新の値
          MAX(CASE WHEN rn = 1 THEN adj_close END) as current_price,
          MAX(CASE WHEN rn = 1 THEN adj_high END) as current_high,
          MAX(CASE WHEN rn = 1 THEN adj_volume END) as current_volume,
          MAX(CASE WHEN rn = 1 THEN turnover END) as current_turnover,
          
          -- 過去の株価 (騰落率・ROC用)
          MAX(CASE WHEN rn = 6 THEN adj_close END) as price_5d_ago,
          MAX(CASE WHEN rn = 21 THEN adj_close END) as price_20d_ago,
          MAX(CASE WHEN rn = 26 THEN adj_close END) as price_25d_ago,
          
          -- RSI用 (14日間の平均値上がり幅・値下がり幅)
          AVG(CASE WHEN rn <= 14 THEN gain END) as avg_gain_14d,
          AVG(CASE WHEN rn <= 14 THEN loss END) as avg_loss_14d,

          -- SMA
          AVG(CASE WHEN rn <= 25 THEN adj_close END) as sma_25,
          AVG(CASE WHEN rn <= 75 THEN adj_close END) as sma_75,
          AVG(CASE WHEN rn <= 200 THEN adj_close END) as sma_200,
          AVG(CASE WHEN rn BETWEEN 2 AND 26 THEN adj_close END) as prev_sma_25,
          
          -- 高値関連 (ブレイクアウト判定用。当日の高値 rn=1 は含めない)
          MAX(CASE WHEN rn BETWEEN 2 AND 21 THEN adj_high END) as max_high_past_20d,
          MAX(CASE WHEN rn BETWEEN 2 AND 61 THEN adj_high END) as max_high_past_60d,
          MAX(CASE WHEN rn BETWEEN 2 AND 251 THEN adj_high END) as high_52w_past, -- 前日までの52週高値
          MAX(CASE WHEN rn <= 250 THEN adj_high END) as high_52w,                 -- 今日を含めた52週高値
          
          -- 出来高・売買代金 (直近5日と、直近25日。倍率計算には過去25日平均を用いる)
          AVG(CASE WHEN rn <= 5 THEN adj_volume END) as avg_volume_5d,
          AVG(CASE WHEN rn <= 5 THEN turnover END) as avg_turnover_5d,
          AVG(CASE WHEN rn BETWEEN 2 AND 26 THEN adj_volume END) as avg_volume_past_25d,
          AVG(CASE WHEN rn BETWEEN 2 AND 26 THEN turnover END) as avg_turnover_past_25d

        FROM RankedQuotes
        GROUP BY ticker
      )
      
      INSERT INTO stocks (
        ticker, name, market, industry, current_price,
        sma_25, is_above_sma_25, sma_25_deviation_pct,
        is_above_sma_75, is_above_sma_200, is_golden_cross,
        high_52w, high_52w_deviation, distance_to_high_52w_pct,
        avg_trading_value_5d, is_perfect_order,
        market_cap, operating_margin_pct, equity_ratio_pct, dividend_yield_pct, 
        revenue_growth_pct, operating_profit_growth_pct, eps_growth_pct,
        rsi, roc, return_5d_pct, return_20d_pct,
        is_high_20d_update, is_high_60d_update, is_high_52w_update,
        volume_ratio, trading_value_ratio,
        long_term_trend, forecast_achievement_pct,
        earnings_date, days_since_earnings, next_earnings_date_prediction, remaining_business_days,
        post_earnings_rise_pct, earnings_reaction_pct, drop_from_post_earnings_high_pct
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
        (met.sma_25 > met.sma_75 AND met.prev_sma_25 <= ps75.sma) as is_golden_cross,
        
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
        CASE WHEN prev_fin.profit > 0 THEN (fin.forecast_profit / prev_fin.profit * 100 - 100) ELSE NULL END as eps_growth_pct,

        -- RSI (14日間単純平均)
        CASE WHEN (met.avg_gain_14d + met.avg_loss_14d) > 0 THEN
          (met.avg_gain_14d / (met.avg_gain_14d + met.avg_loss_14d)) * 100
        ELSE 50 END as rsi,
        
        -- モメンタム・騰落率
        ((met.current_price - met.price_25d_ago) / met.price_25d_ago * 100) as roc,
        ((met.current_price - met.price_5d_ago) / met.price_5d_ago * 100) as return_5d_pct,
        ((met.current_price - met.price_20d_ago) / met.price_20d_ago * 100) as return_20d_pct,
        
        -- ブレイクアウト (高値更新)
        -- ※「当日の高値」が「昨日までの過去N日間の最高値」を上回っているか
        (met.current_high >= met.max_high_past_20d) as is_high_20d_update,
        (met.current_high >= met.max_high_past_60d) as is_high_60d_update,
        (met.current_high >= met.high_52w_past) as is_high_52w_update,
        
        -- 出来高倍率・売買代金倍率 (当日値 ÷ 過去25日平均)
        (met.current_volume / NULLIF(met.avg_volume_past_25d, 0)) as volume_ratio,
        (met.current_turnover / NULLIF(met.avg_turnover_past_25d, 0)) as trading_value_ratio,
        
        -- 長期トレンド判定 (75日線と200日線が両方上向きか)
        CASE 
          WHEN met.sma_75 > ps75.sma AND met.sma_200 > ps200.sma THEN '上昇'
          WHEN met.sma_75 < ps75.sma AND met.sma_200 < ps200.sma THEN '下落'
          ELSE 'もみ合い'
        END as long_term_trend,
        
        -- 予想達成率 (営業利益実績 ÷ 予想営業利益)
        (fin.operating_profit / NULLIF(fin.forecast_operating_profit, 0) * 100) as forecast_achievement_pct,
        
        -- 決算関連
        fin.date as earnings_date,
        CAST(julianday('now') - julianday(fin.date) AS INTEGER) as days_since_earnings,
        date(fin.date, '+3 months') as next_earnings_date_prediction,
        CAST((julianday(date(fin.date, '+3 months')) - julianday('now')) * 5 / 7 AS INTEGER) as remaining_business_days,
        
        -- 決算後上昇率 (決算日以降の終値のうち最新のものと比較。met.current_priceでも可)
        (
          SELECT (met.current_price - dq.adj_close) / dq.adj_close * 100
          FROM daily_quotes dq
          WHERE dq.ticker = fin.ticker AND dq.date <= fin.date
          ORDER BY dq.date DESC LIMIT 1
        ) as post_earnings_rise_pct,
        
        -- 決算反応 (決算日前後の1日騰落率ギャップ)
        (
          SELECT (
            (SELECT adj_close FROM daily_quotes WHERE ticker = fin.ticker AND date > fin.date ORDER BY date ASC LIMIT 1)
            - 
            (SELECT adj_close FROM daily_quotes WHERE ticker = fin.ticker AND date <= fin.date ORDER BY date DESC LIMIT 1)
          ) / NULLIF((SELECT adj_close FROM daily_quotes WHERE ticker = fin.ticker AND date <= fin.date ORDER BY date DESC LIMIT 1), 0) * 100
        ) as earnings_reaction_pct,
        
        -- 決算後高値からの下落率
        (
          SELECT (met.current_price - MAX(dq.adj_high)) / NULLIF(MAX(dq.adj_high), 0) * 100
          FROM daily_quotes dq
          WHERE dq.ticker = fin.ticker AND dq.date >= fin.date
        ) as drop_from_post_earnings_high_pct

      FROM equities_master m
      LEFT JOIN Metrics met ON m.ticker = met.ticker
      LEFT JOIN LatestFinancials fin ON m.ticker = fin.ticker
      LEFT JOIN financials prev_fin ON prev_fin.ticker = fin.ticker AND prev_fin.date = fin.prev_fy_date
      LEFT JOIN prev_sma_75 ps75 ON m.ticker = ps75.ticker AND ps75.date = (SELECT MAX(date) FROM daily_quotes WHERE ticker = m.ticker)
      LEFT JOIN prev_sma_200 ps200 ON m.ticker = ps200.ticker AND ps200.date = (SELECT MAX(date) FROM daily_quotes WHERE ticker = m.ticker)
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
