import { createClient } from '@libsql/client';

async function run() {
  const db = createClient({ url: 'file:local.db' });
  const res = await db.execute("SELECT ticker, name, industry FROM equities_master WHERE name LIKE '%ETF%' OR name LIKE '%投資法人%' LIMIT 10");
  console.log(res.rows);
}

run();
