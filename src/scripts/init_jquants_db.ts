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
      PRIMARY KEY (ticker, date)
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
