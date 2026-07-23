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
        sma_75, is_above_sma_75,
        sma_200, is_above_sma_200,
        high_52w, high_52w_deviation, distance_to_high_52w_pct,
        avg_trading_value_5d, is_perfect_order
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
        
        met.sma_75,
        (met.current_price > met.sma_75) as is_above_sma_75,
        
        met.sma_200,
        (met.current_price > met.sma_200) as is_above_sma_200,
        
        met.high_52w,
        (met.current_price - met.high_52w) as high_52w_deviation,
        ((met.current_price - met.high_52w) / met.high_52w * 100) as distance_to_high_52w_pct,
        
        (met.avg_turnover_5d / 100000000) as avg_trading_value_5d, -- 億円単位
        
        -- パーフェクトオーダー判定 (価格 > 25 > 75 > 200)
        (met.current_price > met.sma_25 AND met.sma_25 > met.sma_75 AND met.sma_75 > met.sma_200) as is_perfect_order

      FROM equities_master m
      LEFT JOIN Metrics met ON m.ticker = met.ticker
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
