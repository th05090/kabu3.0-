import { Client } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ParsedResult } from './phase1_inference';

const EMBED_URL = "http://localhost:11434/api/embeddings";

export function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

export async function runPhase2Vectorization(
  db: Client,
  qdrant: QdrantClient,
  parsedResults: ParsedResult[],
  onProgress?: (msg: string) => void
): Promise<void> {
  console.log("\n=== Phase 2: Vectorization & DB Update ===");
  
  for (let i = 0; i < parsedResults.length; i++) {
    const { analysisText, newsId, ticker, title } = parsedResults[i];
    console.log(`\n[Phase 2: ${i + 1}/${parsedResults.length}] Vectorizing IR News: ${ticker} - ${title}`);
    if (onProgress) onProgress(`[Phase2: ${i + 1}/${parsedResults.length}] ベクトル化: ${ticker} (${title})`);

    // 4. Update ai_reports
    const existingAiReport = await db.execute({
      sql: 'SELECT ir_news_analysis FROM ai_reports WHERE ticker = ?',
      args: [ticker]
    });

    let currentIrNewsAnalysis = "";
    if (existingAiReport.rows.length > 0 && existingAiReport.rows[0].ir_news_analysis) {
       currentIrNewsAnalysis = String(existingAiReport.rows[0].ir_news_analysis) + "\n\n";
    }
    
    currentIrNewsAnalysis += analysisText;

    if (existingAiReport.rows.length === 0) {
       await db.execute({
          sql: 'INSERT INTO ai_reports (ticker, ir_news_analysis, updated_at) VALUES (?, ?, ?)',
          args: [ticker, currentIrNewsAnalysis, new Date().toISOString()]
       });
    } else {
       await db.execute({
          sql: 'UPDATE ai_reports SET ir_news_analysis = ?, updated_at = ? WHERE ticker = ?',
          args: [currentIrNewsAnalysis, new Date().toISOString(), ticker]
       });
    }

    // 5. Update Qdrant company_profiles
    console.log(`  => Updating Qdrant company_profiles vector...`);
    
    const eqRow = await db.execute({
      sql: 'SELECT summary, theme_keywords, main_segment, sub_segments, name FROM equities_master WHERE ticker = ?',
      args: [ticker]
    });

    if (eqRow.rows.length > 0) {
      const eq = eqRow.rows[0];
      const summary = eq.summary ? String(eq.summary) : "";
      const indexKeywords = eq.theme_keywords ? String(eq.theme_keywords) : "";
      let mainSegmentText = "";
      let subSegmentText = "";
      try {
        if (eq.main_segment) {
          const m = JSON.parse(String(eq.main_segment));
          mainSegmentText = `セグメント: ${m.segment}\n説明: ${m.description}`;
        }
        if (eq.sub_segments) {
          const subs = JSON.parse(String(eq.sub_segments));
          subSegmentText = subs.map((s: any) => `セグメント: ${s.segment}\n説明: ${s.description}`).join("\n---\n");
        }
      } catch (e) {}

      const qdrantText = `【企業概要】\n${summary}\n\n【代表的なキーワード】\n${indexKeywords}\n\n【メインセグメント】\n${mainSegmentText}\n\n【サブセグメント】\n${subSegmentText}\n\n【新規事業/IRニュース】\n${currentIrNewsAnalysis}`;
      
      const embedRes = await fetch(EMBED_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "bge-m3", prompt: qdrantText })
      }).then(r => r.json());

      await qdrant.upsert("company_profiles", {
        wait: true,
        points: [
          {
            id: generateUuidForTicker(ticker),
            vector: embedRes.embedding,
            payload: {
              ticker: ticker,
              name: String(eq.name),
              summary: summary,
              keywords: indexKeywords,
              text: qdrantText
            }
          }
        ]
      });
      console.log(`  => Successfully updated Qdrant vector with new IR info.`);
    }

    // 6. Mark as analyzed
    await db.execute({
      sql: 'UPDATE ir_news SET analyzed = 1 WHERE id = ?',
      args: [newsId]
    });

    console.log(`  => Marked as analyzed in DB.`);
  }

  // Unload embedding model
  try {
    await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "bge-m3", keep_alive: 0 })
    });
  } catch(e) {}
}
