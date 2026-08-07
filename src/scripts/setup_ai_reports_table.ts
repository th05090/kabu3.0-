import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

async function main() {
  console.log('Creating ai_reports table...');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ai_reports (
      ticker TEXT PRIMARY KEY,
      current_performance TEXT,
      future_guidance TEXT,
      report_comparison TEXT,
      ai_comment TEXT,
      ir_news_analysis TEXT,
      updated_at TEXT
    );
  `);
  console.log('ai_reports table created successfully.');
}

main().catch(console.error);
