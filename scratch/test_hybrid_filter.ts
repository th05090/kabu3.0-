import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GICS_DICTIONARY } from '../src/data/gics_dictionary';
import { TSE_TO_GICS_MAPPING } from '../src/lib/anomaly_detector';

const db = createClient({ url: 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });

function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

async function run() {
  const targets = await db.execute(`
    SELECT ticker, name, theme_keywords, summary, industry 
    FROM equities_master 
    WHERE ticker IN ('13010')
  `);

  for (const t of targets.rows) {
    const ticker = String(t.ticker);
    const tseIndustry = String(t.industry);
    const allowedSectors = TSE_TO_GICS_MAPPING[tseIndustry] || [];

    console.log(`\n===========================================`);
    console.log(`[${ticker}] ${t.name} (TSE: ${tseIndustry})`);
    console.log(`Allowed GICS Sectors: ${allowedSectors.join(', ')}`);
    
    const companyId = generateUuidForTicker(ticker);
    const points = await qdrant.retrieve("company_profiles", { ids: [companyId], with_vector: true });
    
    // Dense Search
    const searchRes = await qdrant.search("gics_categories", {
      vector: points[0].vector as number[],
      limit: 100, // Fetch more so we can filter
      with_payload: true
    });

    const denseMap = new Map();
    let denseRank = 1;
    for (const r of searchRes) {
      const gicsId = String(r.payload?.sub_industry_id);
      const gicsInfo = GICS_DICTIONARY[gicsId];
      if (gicsInfo && allowedSectors.includes(gicsInfo.sector_name)) {
        denseMap.set(gicsId, { rank: denseRank++, name: gicsInfo.sub_industry_name, sector: gicsInfo.sector_name });
      }
    }

    // Sparse Search
    const kwList = String(t.theme_keywords).split(',').map(k => k.trim()).filter(k => k);
    const sparseMap = new Map();
    if (kwList.length > 0) {
      const matchQuery = kwList.map(kw => `"${kw.replace(/"/g, '""')}"`).join(' OR ');
      const ftsSql = `
        SELECT sub_industry_id, category_name, bm25(gics_fts) as score
        FROM gics_fts WHERE gics_fts MATCH ? ORDER BY score ASC LIMIT 50
      `;
      try {
        const ftsRes = await db.execute({ sql: ftsSql, args: [matchQuery] });
        let sparseRank = 1;
        for (const r of ftsRes.rows) {
          const gicsId = String(r.sub_industry_id);
          const gicsInfo = GICS_DICTIONARY[gicsId];
          if (gicsInfo && allowedSectors.includes(gicsInfo.sector_name)) {
            sparseMap.set(gicsId, { rank: sparseRank++, name: gicsInfo.sub_industry_name, sector: gicsInfo.sector_name });
          }
        }
      } catch(e) {}
    }

    // RRF (K=5)
    const K = 5;
    const combined = new Set([...denseMap.keys(), ...sparseMap.keys()]);
    const rrfResults = Array.from(combined).map(id => {
      const dense = denseMap.get(id) || { rank: 20, name: sparseMap.get(id).name };
      const sparse = sparseMap.get(id) || { rank: 20, name: dense.name };
      const rrf = (1 / (K + dense.rank)) + (1 / (K + sparse.rank));
      return { id, name: dense.name, rrf, denseRank: dense.rank, sparseRank: sparse.rank };
    }).sort((a, b) => b.rrf - a.rrf);

    console.log(`\n--- Filtered Hybrid RRF Top 5 ---`);
    rrfResults.slice(0, 5).forEach((r, i) => {
      console.log(`${i+1}. ${r.name} (ID: ${r.id}) | RRF: ${r.rrf.toFixed(4)} | D-Rank: ${r.denseRank}, S-Rank: ${r.sparseRank}`);
    });
  }
}
run();
