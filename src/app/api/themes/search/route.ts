import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { QdrantClient } from "@qdrant/js-client-rest";

const EMBED_URL = "http://localhost:11434/api/embeddings";
const QDRANT_URL = "http://localhost:6333";
const qdrant = new QdrantClient({ url: QDRANT_URL });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, expandedKeywords } = body;
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Combine original query and expanded keywords for dense embedding
    const embedPrompt = expandedKeywords ? `${query} ${expandedKeywords}` : query;

    // 1. Dense Search (Qdrant)
    const embedRes = await fetch(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "bge-m3", prompt: embedPrompt })
    });
    const embedData = await embedRes.json();
    const embedding = embedData.embedding;

    const denseSearchRes = await qdrant.search("company_profiles", {
      vector: embedding,
      limit: 50,
      with_payload: true
    });

    const denseMap = new Map();
    denseSearchRes.forEach((r, i) => denseMap.set(String(r.payload?.ticker), { score: r.score, rank: i + 1 }));

    // 2. Sparse Search (SQLite FTS5)
    const kwList = expandedKeywords 
      ? expandedKeywords.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k)
      : [];

    const sparseMap = new Map();
    if (kwList.length > 0) {
      const matchQuery = kwList.map((kw: string) => `"${kw.replace(/"/g, '""')}"`).join(' OR ');
      try {
        const ftsSql = `
          SELECT ticker, bm25(equities_fts) as bm25_score
          FROM equities_fts 
          WHERE equities_fts MATCH ?
          ORDER BY bm25_score ASC
          LIMIT 50
        `;
        const ftsRes = await db.execute({ sql: ftsSql, args: [matchQuery] });
        ftsRes.rows.forEach((r, i) => {
          sparseMap.set(String(r.ticker), { score: -Number(r.bm25_score), rank: i + 1 });
        });
      } catch (err) {
        console.warn("FTS5 query failed:", err);
      }
    }

    // 3. Combine Tickers
    const combinedTickers = new Set([...denseMap.keys(), ...sparseMap.keys()]);
    const tickersArr = Array.from(combinedTickers);

    if (tickersArr.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // 4. Fetch DB Data for all combined tickers
    const placeholders = tickersArr.map(() => '?').join(',');
    const sql = `
      SELECT s.*, m.summary, m.theme_keywords, m.gics_similarity_score 
      FROM stocks s
      JOIN equities_master m ON s.ticker = m.ticker
      WHERE s.ticker IN (${placeholders})
      AND m.name NOT LIKE '%ETF%'
      AND m.name NOT LIKE '%ＥＴＦ%'
      AND m.name NOT LIKE '%投信%'
      AND m.name NOT LIKE '%投資法人%'
      AND m.name NOT LIKE '%ファンド%'
      AND m.name NOT LIKE '%ブル%'
      AND m.name NOT LIKE '%ベア%'
    `;
    const dbRes = await db.execute({ sql, args: tickersArr });

    // 5. Calculate RRF Score
    const K = 60;
    const finalResults = dbRes.rows.map(row => {
      const ticker = String(row.ticker);
      const denseInfo = denseMap.get(ticker) || { score: 0, rank: 100 }; // Rank 100 penalty if not in top 50
      const sparseInfo = sparseMap.get(ticker) || { score: 0, rank: 100 }; // Rank 100 penalty if not in top 50

      const rrfScore = (1 / (K + denseInfo.rank)) + (1 / (K + sparseInfo.rank));

      return {
        ...row,
        dense_score: denseInfo.score,
        dense_rank: denseInfo.rank,
        sparse_score: sparseInfo.score,
        sparse_rank: sparseInfo.rank,
        search_score: rrfScore
      };
    });

    // 6. Sort by final RRF score and slice top 50
    finalResults.sort((a: any, b: any) => b.search_score - a.search_score);
    const top50Results = finalResults.slice(0, 50);

    return NextResponse.json({ results: top50Results });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
