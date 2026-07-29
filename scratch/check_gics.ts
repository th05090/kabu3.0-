import { db } from '../src/lib/db.js';
async function run() {
  const res = await db.execute("SELECT e.name, g.sub_industry_name FROM equities_master e LEFT JOIN gics_categories g ON e.gics_sub_industry_id = g.sub_industry_id WHERE e.ticker IN ('80580', '13750', '77440', '13010', '67580', '65010', '68040')");
  console.table(res.rows);
}
run();