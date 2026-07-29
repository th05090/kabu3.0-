import { createClient } from '@libsql/client';

async function run() {
  const db = createClient({ url: 'file:local.db' });
  const res = await db.execute("SELECT * FROM equities_master WHERE ticker = '13010'");
  console.log(res.rows[0]);
}
run();
