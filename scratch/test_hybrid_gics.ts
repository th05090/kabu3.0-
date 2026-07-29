import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GICS_DICTIONARY } from '../src/data/gics_dictionary';

const db = createClient({ url: 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });

function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

async function run() {
  // Get specific companies
  const targets = await db.execute(`
    SELECT ticker, name, theme_keywords, summary 
    FROM equities_master 
    WHERE ticker IN ('13010', '13750', '13770')
  `);

  for (const t of targets.rows) {
    const ticker = String(t.ticker);
    console.log(`\n===========================================`);
    console.log(`[${ticker}] ${t.name}`);
    console.log(`Keywords: ${t.theme_keywords}`);
    
    // 1. Dense Search
    const companyId = generateUuidForTicker(ticker);
    const points = await qdrant.retrieve("company_profiles", { ids: [companyId], with_vector: true });
    if (points.length === 0 || !points[0].vector) continue;

    const searchRes = await qdrant.search("gics_categories", {
      vector: points[0].vector as number[],
      limit: 10,
      with_payload: true
    });

    const denseMap = new Map();
    searchRes.forEach((r, i) => denseMap.set(String(r.payload?.sub_industry_id), { rank: i + 1, name: r.payload?.category_name }));

    // 2. Sparse Search
    const kwList = String(t.theme_keywords).split(',').map(k => k.trim()).filter(k => k);
    const sparseMap = new Map();
    if (kwList.length > 0) {
      const matchQuery = kwList.map(kw => `"${kw.replace(/"/g, '""')}"`).join(' OR ');
      const ftsSql = `
        SELECT sub_industry_id, category_name, bm25(gics_fts) as score
        FROM gics_fts WHERE gics_fts MATCH ? ORDER BY score ASC LIMIT 10
      `;
      try {
        const ftsRes = await db.execute({ sql: ftsSql, args: [matchQuery] });
        ftsRes.rows.forEach((r, i) => sparseMap.set(String(r.sub_industry_id), { rank: i + 1, name: r.category_name }));
      } catch(e) {}
    }

    // 3. RRF (K=5)
    const K = 5;
    const combined = new Set([...denseMap.keys(), ...sparseMap.keys()]);
    const rrfResults = Array.from(combined).map(id => {
      const dense = denseMap.get(id) || { rank: 20, name: sparseMap.get(id).name };
      const sparse = sparseMap.get(id) || { rank: 20, name: dense.name };
      const rrf = (1 / (K + dense.rank)) + (1 / (K + sparse.rank));
      return { id, name: dense.name, rrf, denseRank: dense.rank, sparseRank: sparse.rank };
    }).sort((a, b) => b.rrf - a.rrf);

    console.log(`\n--- Dense Top 1 (Old Method) ---`);
    if (searchRes.length > 0) {
      console.log(`1. ${searchRes[0].payload?.category_name} (ID: ${searchRes[0].payload?.sub_industry_id})`);
    }

    console.log(`\n--- Hybrid RRF Top 3 (New Method) ---`);
    rrfResults.slice(0, 3).forEach((r, i) => {
      console.log(`${i+1}. ${r.name} (ID: ${r.id}) | RRF: ${r.rrf.toFixed(4)} | D-Rank: ${r.denseRank}, S-Rank: ${r.sparseRank}`);
    });
  }
}

run();
