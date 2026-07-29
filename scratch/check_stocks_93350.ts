import { db } from '../src/lib/db.js';
async function run() {
  const res1 = await db.execute("SELECT COUNT(*) FROM stocks");
  console.log('stocks total count: ', res1.rows[0]);
  
  const res2 = await db.execute("SELECT COUNT(*) FROM equities_master");
  console.log('equities_master total count: ', res2.rows[0]);
}
run();
