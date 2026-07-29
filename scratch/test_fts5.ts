import { createClient } from '@libsql/client';

async function run() {
  const db = createClient({ url: 'file:local.db' });
  const keywords = [
    "エッジAI", "マシンビジョン", "自律移動ロボット", "協働ロボット", 
    "ティーチレス", "モーションコントロール", "サーボモータ", "精密減速機", 
    "センサーフュージョン", "デジタルツイン"
  ];
  
  const matchQuery = keywords.map(kw => `"${kw.replace(/"/g, '""')}"`).join(' OR ');
  console.log("Match Query:", matchQuery);

  const sql = `
    SELECT ticker, bm25(equities_fts) as score
    FROM equities_fts 
    WHERE equities_fts MATCH ?
    ORDER BY score ASC
    LIMIT 20
  `;
  
  try {
    const res = await db.execute({ sql, args: [matchQuery] });
    console.log(`Found ${res.rows.length} sparse matches.`);
    for (const r of res.rows) {
      // get name
      const nameRes = await db.execute({ sql: "SELECT name, summary, theme_keywords FROM equities_master WHERE ticker = ?", args: [r.ticker] });
      const name = nameRes.rows[0].name;
      console.log(`- [${r.ticker}] ${name} : BM25 = ${r.score}`);
    }
  } catch(e) {
    console.error(e);
  }
}
run();
