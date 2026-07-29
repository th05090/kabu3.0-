import { createClient } from '@libsql/client';
async function run() {
  const db = createClient({ url: 'file:local.db' });
  const res = await db.execute("SELECT ticker, name, summary, theme_keywords, main_segment, theme, gics_sub_industry_id FROM equities_master WHERE ticker IN ('13010', '13770')");
  console.log(res.rows);
}
run();
