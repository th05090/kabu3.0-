import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { QdrantClient } from "@qdrant/js-client-rest";
import { GICS_DICTIONARY } from '@/data/gics_dictionary';

const EMBED_URL = "http://localhost:11434/api/embeddings";
const QDRANT_URL = "http://localhost:6333";

const qdrant = new QdrantClient({ url: QDRANT_URL });

function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const body = await request.json();
    const { ticker } = await params;

    // Fetch existing values first
    const existingRes = await db.execute({
      sql: 'SELECT summary, theme_keywords FROM equities_master WHERE ticker = ?',
      args: [ticker]
    });
    
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
    }

    const summary = body.summary !== undefined ? body.summary : existingRes.rows[0].summary;
    const themeKeywords = body.theme_keywords !== undefined ? body.theme_keywords : existingRes.rows[0].theme_keywords;

    if (!summary || typeof summary !== 'string') {
      return NextResponse.json({ error: 'Valid summary text is required' }, { status: 400 });
    }

    // 1. Update equities_master
    await db.execute({
      sql: 'UPDATE equities_master SET summary = ?, theme_keywords = ? WHERE ticker = ?',
      args: [summary, themeKeywords, ticker],
    });

    // 3. Re-embed the text
    const indexKeywords = themeKeywords || "";
    const qdrantText = `【事業要約】\n${summary}\n\n【機能的価値キーワード】\n${indexKeywords}`;
    const embedRes = await fetch(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "bge-m3", prompt: qdrantText })
    });
    const embedData = await embedRes.json();
    const embedding = embedData.embedding;

    // 4. Search for best GICS category
    const searchRes = await qdrant.search("gics_categories", {
      vector: embedding,
      limit: 1,
      with_payload: true
    });

    let newGicsId = null;
    let newGicsScore = null;
    let newTheme = null;
    if (searchRes.length > 0 && searchRes[0].payload) {
      newGicsId = String(searchRes[0].payload.sub_industry_id);
      newGicsScore = searchRes[0].score;
      if (GICS_DICTIONARY[newGicsId]) {
        newTheme = GICS_DICTIONARY[newGicsId].sector_name;
      }
    }

    if (newGicsId) {
      await db.execute({
        sql: 'UPDATE equities_master SET gics_sub_industry_id = ?, gics_similarity_score = ?, theme = ? WHERE ticker = ?',
        args: [newGicsId, newGicsScore, newTheme, ticker],
      });
    }

    // 5. Update company_profiles in Qdrant to keep it consistent
    try {
      // Get the company name
      const eqRes = await db.execute({
        sql: 'SELECT name FROM equities_master WHERE ticker = ?',
        args: [ticker]
      });
      const companyName = eqRes.rows.length > 0 ? String(eqRes.rows[0].name) : ticker;

      await qdrant.upsert("company_profiles", {
        wait: true,
        points: [
          {
            id: generateUuidForTicker(ticker),
            vector: embedding,
            payload: {
              ticker: ticker,
              name: companyName,
              summary: summary,
              keywords: indexKeywords,
              text: qdrantText
            }
          }
        ]
      });
    } catch (e) {
      console.warn("Failed to update Qdrant company_profiles:", e);
    }

    return NextResponse.json({ success: true, newGicsId });
  } catch (error: any) {
    console.error('Failed to update summary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
