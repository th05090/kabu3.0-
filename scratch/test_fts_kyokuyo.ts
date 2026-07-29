import { createClient } from '@libsql/client';

async function run() {
  const db = createClient({ url: 'file:local.db' });
  const kwList = ['水産品貿易', '水産品加工', '業務用食品', '海外加工', 'すしネタ'];
  const matchQuery = kwList.map(kw => `"${kw}"`).join(' OR ');
  const res = await db.execute({ sql: 'SELECT category_name, bm25(gics_fts) as score FROM gics_fts WHERE gics_fts MATCH ?', args: [matchQuery] });
  console.log(res.rows);
}
run();
