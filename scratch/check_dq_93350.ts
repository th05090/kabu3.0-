import { db } from '../src/lib/db.js';
async function run() {
  const res1 = await db.execute("SELECT COUNT(*) FROM daily_quotes WHERE ticker = '93350'");
  console.log('daily quotes 93350: ', res1.rows[0]);
  const res2 = await db.execute("SELECT COUNT(*) FROM financials WHERE ticker = '93350'");
  console.log('financials 93350: ', res2.rows[0]);
}
run();
