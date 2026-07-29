import { createClient } from '@libsql/client';
async function run() {
  const db = createClient({ url: 'file:local.db' });
  const res = await db.execute("SELECT name, summary, theme_keywords FROM equities_master WHERE ticker IN ('69540', '65060', '68610')");
  console.log(res.rows);
}
run();
