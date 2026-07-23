import { createClient } from '@libsql/client';

const db = createClient({
  url: 'file:local.db',
});

async function main() {
  console.log('Dropping existing table if exists...');
  await db.execute(`DROP TABLE IF EXISTS stocks;`);

  console.log('Creating stocks table...');
  await db.execute(`
    CREATE TABLE stocks (
      ticker TEXT PRIMARY KEY,
      name TEXT,
      market TEXT,
      industry TEXT,
      theme TEXT,
      theme_score REAL,
      
      current_price REAL,
      market_cap REAL,
      avg_trading_value_5d REAL,
      volume_ratio REAL,
      trading_value_ratio REAL,
      
      revenue_growth_pct REAL,
      operating_profit_growth_pct REAL,
      operating_margin_pct REAL,
      eps_growth_pct REAL,
      equity_ratio_pct REAL,
      operating_cf REAL,
      dividend_yield_pct REAL,
      
      forecast_achievement_pct REAL,
      earnings_reaction_pct REAL,
      post_earnings_rise_pct REAL,
      drop_from_post_earnings_high_pct REAL,
      earnings_category TEXT,
      earnings_date TEXT,
      days_since_earnings INTEGER,
      next_earnings_date_prediction TEXT,
      remaining_business_days INTEGER,
      
      sma_25 REAL,
      is_above_sma_25 BOOLEAN,
      sma_25_deviation_pct REAL,
      is_above_sma_75 BOOLEAN,
      is_above_sma_200 BOOLEAN,
      long_term_trend TEXT,
      high_52w REAL,
      high_52w_deviation REAL,
      distance_to_high_52w_pct REAL,
      is_high_52w_update BOOLEAN,
      
      is_perfect_order BOOLEAN,
      is_golden_cross BOOLEAN,
      rsi REAL,
      roc REAL,
      return_5d_pct REAL,
      return_20d_pct REAL,
      is_high_20d_update BOOLEAN,
      is_high_60d_update BOOLEAN
    );
  `);

  console.log('Generating mock data...');
  const industries = ['情報・通信業', '電気機器', 'サービス業', '小売業', '機械', '銀行業', '医薬品'];
  const markets = ['プライム', 'スタンダード', 'グロース'];
  const earningsCategories = ['本決算', '第1四半期', '第2四半期', '第3四半期'];

  const values: any[] = [];
  
  for (let i = 1; i <= 100; i++) {
    const ticker = (1000 + i * 10).toString();
    const name = `テスト銘柄${i}`;
    const industry = industries[Math.floor(Math.random() * industries.length)];
    const market = markets[Math.floor(Math.random() * markets.length)];
    
    // Random basic metrics
    const currentPrice = Math.floor(Math.random() * 9000) + 100;
    const isAbove25 = Math.random() > 0.5;
    
    values.push({
      ticker, name, market, industry,
      theme: industry, // 初期は業種と同値
      theme_score: Number((Math.random() * 100).toFixed(1)),
      
      current_price: currentPrice,
      market_cap: Math.floor(Math.random() * 10000) + 50, // 億円
      avg_trading_value_5d: Math.floor(Math.random() * 1000) + 10,
      volume_ratio: Number((Math.random() * 5).toFixed(2)),
      trading_value_ratio: Number((Math.random() * 5).toFixed(2)),
      
      revenue_growth_pct: Number(((Math.random() - 0.2) * 50).toFixed(1)),
      operating_profit_growth_pct: Number(((Math.random() - 0.2) * 50).toFixed(1)),
      operating_margin_pct: Number((Math.random() * 30).toFixed(1)),
      eps_growth_pct: Number(((Math.random() - 0.2) * 50).toFixed(1)),
      equity_ratio_pct: Number((Math.random() * 80 + 10).toFixed(1)),
      operating_cf: Math.floor((Math.random() - 0.2) * 1000),
      dividend_yield_pct: Number((Math.random() * 5).toFixed(2)),
      
      forecast_achievement_pct: Number((Math.random() * 100).toFixed(1)),
      earnings_reaction_pct: Number(((Math.random() - 0.5) * 20).toFixed(1)),
      post_earnings_rise_pct: Number(((Math.random() - 0.2) * 20).toFixed(1)),
      drop_from_post_earnings_high_pct: Number((Math.random() * -20).toFixed(1)),
      earnings_category: earningsCategories[Math.floor(Math.random() * earningsCategories.length)],
      earnings_date: `2024-${Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}-15`,
      days_since_earnings: Math.floor(Math.random() * 60),
      next_earnings_date_prediction: '2024-11-15',
      remaining_business_days: Math.floor(Math.random() * 40),
      
      sma_25: Math.floor(currentPrice * (Math.random() * 0.4 + 0.8)),
      is_above_sma_25: isAbove25,
      sma_25_deviation_pct: Number(((Math.random() - 0.5) * 10).toFixed(1)),
      is_above_sma_75: Math.random() > 0.5,
      is_above_sma_200: Math.random() > 0.5,
      long_term_trend: Math.random() > 0.5 ? 'Uptrend' : 'Downtrend',
      high_52w: Math.floor(currentPrice * (Math.random() * 0.5 + 1)),
      high_52w_deviation: Number(((Math.random() - 0.5) * 20).toFixed(1)),
      distance_to_high_52w_pct: Number((Math.random() * 30).toFixed(1)),
      is_high_52w_update: Math.random() > 0.9,
      
      is_perfect_order: Math.random() > 0.8,
      is_golden_cross: Math.random() > 0.9,
      rsi: Number((Math.random() * 100).toFixed(1)),
      roc: Number(((Math.random() - 0.5) * 30).toFixed(1)),
      return_5d_pct: Number(((Math.random() - 0.5) * 15).toFixed(1)),
      return_20d_pct: Number(((Math.random() - 0.5) * 30).toFixed(1)),
      is_high_20d_update: Math.random() > 0.8,
      is_high_60d_update: Math.random() > 0.9,
    });
  }

  // Insert in chunks or all at once (100 is small enough)
  console.log('Inserting data...');
  
  for (const v of values) {
    await db.execute({
      sql: `
        INSERT INTO stocks (
          ticker, name, market, industry, theme, theme_score,
          current_price, market_cap, avg_trading_value_5d, volume_ratio, trading_value_ratio,
          revenue_growth_pct, operating_profit_growth_pct, operating_margin_pct, eps_growth_pct, equity_ratio_pct, operating_cf, dividend_yield_pct,
          forecast_achievement_pct, earnings_reaction_pct, post_earnings_rise_pct, drop_from_post_earnings_high_pct, earnings_category, earnings_date, days_since_earnings, next_earnings_date_prediction, remaining_business_days,
          sma_25, is_above_sma_25, sma_25_deviation_pct, is_above_sma_75, is_above_sma_200, long_term_trend, high_52w, high_52w_deviation, distance_to_high_52w_pct, is_high_52w_update,
          is_perfect_order, is_golden_cross, rsi, roc, return_5d_pct, return_20d_pct, is_high_20d_update, is_high_60d_update
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `,
      args: [
        v.ticker, v.name, v.market, v.industry, v.theme, v.theme_score,
        v.current_price, v.market_cap, v.avg_trading_value_5d, v.volume_ratio, v.trading_value_ratio,
        v.revenue_growth_pct, v.operating_profit_growth_pct, v.operating_margin_pct, v.eps_growth_pct, v.equity_ratio_pct, v.operating_cf, v.dividend_yield_pct,
        v.forecast_achievement_pct, v.earnings_reaction_pct, v.post_earnings_rise_pct, v.drop_from_post_earnings_high_pct, v.earnings_category, v.earnings_date, v.days_since_earnings, v.next_earnings_date_prediction, v.remaining_business_days,
        v.sma_25, v.is_above_sma_25, v.sma_25_deviation_pct, v.is_above_sma_75, v.is_above_sma_200, v.long_term_trend, v.high_52w, v.high_52w_deviation, v.distance_to_high_52w_pct, v.is_high_52w_update,
        v.is_perfect_order, v.is_golden_cross, v.rsi, v.roc, v.return_5d_pct, v.return_20d_pct, v.is_high_20d_update, v.is_high_60d_update
      ]
    });
  }

  console.log('Seeding completed!');
}

main().catch(console.error);
