import { db } from '../src/lib/db.js';
async function run() {
  const res = await db.execute("SELECT market, COUNT(1) as count FROM stocks GROUP BY market");
  console.table(res.rows);
}
run();
