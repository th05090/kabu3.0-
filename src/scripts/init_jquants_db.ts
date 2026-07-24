import { createClient } from '@libsql/client';

const db = createClient({
  url: 'file:local.db',
});

async function main() {
  console.log('Creating history tables...');

  // equities_master (銘柄基本情報)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS equities_master (
      ticker TEXT PRIMARY KEY,
      name TEXT,
      market TEXT,
      industry TEXT,
      last_updated TEXT
    );
  `);

  // daily_quotes (日足データ)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_quotes (
      ticker TEXT,
      date TEXT,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume REAL,
      turnover REAL,
      adj_open REAL,
      adj_high REAL,
      adj_low REAL,
      adj_close REAL,
      adj_volume REAL,
      PRIMARY KEY (ticker, date)
    );
  `);

  // financials (財務情報)
  await db.execute('DROP TABLE IF EXISTS financials');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS financials (
      ticker TEXT,
      date TEXT,
      net_sales REAL,
      operating_profit REAL,
      profit REAL,
      equity_to_asset_ratio REAL,
      shares_outstanding REAL,
      forecast_net_sales REAL,
      forecast_operating_profit REAL,
      forecast_profit REAL,
      forecast_dividend REAL,
      eps REAL,
      adj_eps REAL,
      adj_dividend REAL,
      adj_shares_outstanding REAL,
      ordinary_profit REAL,
      total_assets REAL,
      equity REAL,
      operating_cash_flow REAL,
      investing_cash_flow REAL,
      financing_cash_flow REAL,
      cash_and_equivalents REAL,
      PRIMARY KEY (ticker, date)
    );
  `);

  // stocks (集計済み最新指標データ)
  await db.execute('DROP TABLE IF EXISTS stocks');
  await db.execute(`
    CREATE TABLE stocks (
      ticker TEXT PRIMARY KEY,
      name TEXT,
      market TEXT,
      industry TEXT,
      current_price REAL,
      
      -- トレンド指標
      sma_25 REAL,
      is_above_sma_25 BOOLEAN,
      sma_25_deviation_pct REAL,
      is_above_sma_75 BOOLEAN,
      is_above_sma_200 BOOLEAN,
      is_golden_cross BOOLEAN,
      is_perfect_order BOOLEAN,
      long_term_trend TEXT,
      
      -- ブレイクアウト・高値
      high_52w REAL,
      high_52w_deviation REAL,
      distance_to_high_52w_pct REAL,
      is_high_20d_update BOOLEAN,
      is_high_60d_update BOOLEAN,
      is_high_52w_update BOOLEAN,
      
      -- モメンタム・流動性
      avg_trading_value_5d REAL,
      volume_ratio REAL,
      trading_value_ratio REAL,
      rsi REAL,
      roc REAL,
      return_5d_pct REAL,
      return_20d_pct REAL,
      
      -- ファンダメンタルズ・決算
      market_cap REAL,
      operating_margin_pct REAL,
      equity_ratio_pct REAL,
      dividend_yield_pct REAL,
      revenue_growth_pct REAL,
      operating_profit_growth_pct REAL,
      eps_growth_pct REAL,
      forecast_achievement_pct REAL,
      
      earnings_date TEXT,
      days_since_earnings INTEGER,
      next_earnings_date_prediction TEXT,
      remaining_business_days INTEGER,
      post_earnings_rise_pct REAL,
      earnings_reaction_pct REAL,
      drop_from_post_earnings_high_pct REAL,
      
      -- Phase 2 additions
      macd REAL,
      macd_signal REAL,
      atr_14 REAL,
      atr_pct REAL,
      stop_loss_2atr REAL,
      stop_loss_3atr REAL,
      max_drawdown REAL,
      volatility REAL,
      per REAL,
      pbr REAL,
      psr REAL,
      roe REAL,
      roa REAL
    );
  `);

  // Index creation for fast lookups and fast UPDATEs during stock splits
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_daily_quotes_ticker ON daily_quotes(ticker);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_daily_quotes_date ON daily_quotes(date);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_financials_ticker ON financials(ticker);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_financials_date ON financials(date);`);

  console.log('Database initialization completed.');
}

main().catch(console.error);
