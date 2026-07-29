import { db } from '../src/lib/db.js';
async function run() {
  const resTotal = await db.execute("SELECT COUNT(1) as cnt FROM equities_master");
  console.log('Total equities: ', resTotal.rows[0].cnt);

  const resNull = await db.execute("SELECT COUNT(1) as cnt FROM equities_master WHERE gics_sub_industry_id IS NULL");
  console.log('gics_sub_industry_id IS NULL: ', resNull.rows[0].cnt);
  
  const resLengthCheck = await db.execute("SELECT length(gics_sub_industry_id) as len, COUNT(1) as cnt FROM equities_master WHERE gics_sub_industry_id IS NOT NULL GROUP BY length(gics_sub_industry_id)");
  console.log('GICS ID Length distribution:');
  console.table(resLengthCheck.rows);

  const resSample = await db.execute("SELECT ticker, name, gics_sub_industry_id, summary FROM equities_master WHERE length(gics_sub_industry_id) = 8 AND ticker NOT IN ('80580', '13750', '77440', '13010', '67580', '65010', '68040') ORDER BY ticker DESC LIMIT 5");
  console.table(resSample.rows);
}
run();
