import { createClient } from '@libsql/client';

async function run() {
  const db = createClient({ url: 'file:local.db' });
  const res = await db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='equities_master'");
  console.log(res.rows[0].sql);
}

run();
