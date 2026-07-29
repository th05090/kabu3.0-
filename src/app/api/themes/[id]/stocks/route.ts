import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = "http://localhost:6333";
const qdrant = new QdrantClient({ url: QDRANT_URL });

function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

// Compute cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 1. Fetch stocks in the theme
    const stocksRes = await db.execute({
      sql: `
        SELECT ts.similarity_score as theme_score, s.*, m.summary, m.theme_keywords
        FROM custom_theme_stocks ts
        JOIN stocks s ON ts.ticker = s.ticker
        JOIN equities_master m ON s.ticker = m.ticker
        WHERE ts.theme_id = ?
        ORDER BY ts.similarity_score DESC
      `,
      args: [id]
    });

    const stocks = stocksRes.rows;

    if (stocks.length === 0) {
      return NextResponse.json({ stocks: [], network: { nodes: [], links: [] } });
    }

    // 2. Build Network Graph Data
    // Fetch vectors for all stocks from Qdrant
    const uuids = stocks.map(s => generateUuidForTicker(String(s.ticker)));
    
    let points: any[] = [];
    try {
      points = await qdrant.retrieve("company_profiles", {
        ids: uuids,
        with_vector: true
      });
    } catch (e) {
      console.warn("Could not fetch vectors for network graph:", e);
    }

    const nodes = stocks.map(s => ({
      id: s.ticker,
      name: s.name,
      group: s.industry || 'Unknown',
      val: Math.max(1, (Number(s.market_cap) || 100) / 1000) // Node size based on market cap
    }));

    const links = [];
    
    // Calculate pairwise similarities if we have vectors
    if (points.length > 1) {
      const vectorMap = new Map();
      points.forEach(p => {
        if (p.vector && p.payload) {
          vectorMap.set(p.payload.ticker, p.vector);
        }
      });

      for (let i = 0; i < stocks.length; i++) {
        for (let j = i + 1; j < stocks.length; j++) {
          const t1 = String(stocks[i].ticker);
          const t2 = String(stocks[j].ticker);
          const v1 = vectorMap.get(t1);
          const v2 = vectorMap.get(t2);
          
          if (v1 && v2) {
            const sim = cosineSimilarity(v1 as number[], v2 as number[]);
            // Only create an edge if similarity is high enough
            if (sim > 0.65) {
              links.push({
                source: t1,
                target: t2,
                similarity: sim
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ 
      stocks, 
      network: { nodes, links }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { ticker, similarity_score } = await request.json();
    
    if (!ticker) return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });

    // Validate ticker exists
    const checkRes = await db.execute({
      sql: 'SELECT ticker FROM stocks WHERE ticker = ?',
      args: [ticker]
    });
    
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
    }

    await db.execute({
      sql: 'INSERT OR IGNORE INTO custom_theme_stocks (theme_id, ticker, similarity_score) VALUES (?, ?, ?)',
      args: [id, ticker, similarity_score || 1.0]
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    
    if (!ticker) return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });

    await db.execute({
      sql: 'DELETE FROM custom_theme_stocks WHERE theme_id = ? AND ticker = ?',
      args: [id, ticker]
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
