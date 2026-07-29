import { createClient } from '@libsql/client';

async function run() {
  const db = createClient({ url: 'file:local.db' });
  const res = await db.execute({
    sql: 'SELECT category_name, bm25(gics_fts) as score FROM gics_fts WHERE gics_fts MATCH ?', 
    args:['"水産加工"']
  });
  console.log(res.rows);
}
run();
