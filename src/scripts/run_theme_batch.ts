import { createClient } from "@libsql/client";
import { QdrantClient } from "@qdrant/js-client-rest";
import { askLLM, pass1PromptTemplate, pass2PromptTemplate, step2PromptTemplate, unifiedPromptTemplate } from "./rag/theme_prompts.js";

const DB_URL = "file:local.db";
const EMBED_URL = "http://localhost:11434/api/embeddings";
const QDRANT_URL = "http://localhost:6333";

async function main() {
  const db = createClient({ url: DB_URL });
  const qdrant = new QdrantClient({ url: QDRANT_URL });

  // Add column for final theme if it doesn't exist
  try {
    await db.execute("ALTER TABLE equities_master ADD COLUMN theme TEXT");
    await db.execute("ALTER TABLE equities_master ADD COLUMN summary TEXT");
    await db.execute("ALTER TABLE equities_master ADD COLUMN main_segment TEXT");
  } catch (e) {
    // Column might already exist, ignore
  }

  // Ensure Qdrant collection for profiles exists
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === "company_profiles");
    if (!exists) {
      await qdrant.createCollection("company_profiles", {
        vectors: { size: 1024, distance: "Cosine" }
      });
      console.log("Created Qdrant collection: company_profiles");
    }
  } catch (e) {
    console.error("Warning: Failed to check/create Qdrant collection:", e);
  }

  // Get tickers that don't have a summary yet (Exclude ETFs and REITs by name)
  const targetsResult = await db.execute(`
    SELECT ticker, name FROM equities_master 
    WHERE sub_segments IS NULL 
      AND name NOT LIKE '%ETF%'
      AND name NOT LIKE '%ETN%'
      AND name NOT LIKE '%REIT%'
      AND name NOT LIKE '%リート%'
      AND name NOT LIKE '%ＥＴＦ%'
      AND name NOT LIKE '%投資法人%'
      AND name NOT LIKE '%ファンド%'
    ORDER BY ticker ASC
  `);

  const targets = targetsResult.rows;
  console.log(`Found ${targets.length} companies to process for summary extraction.`);

  for (const t of targets) {
    const ticker5 = String(t.ticker);
    const companyName = String(t.name);
    console.log(`\n=========================================`);
    console.log(`Processing [${companyName}] (${ticker5})`);
    console.log(`=========================================`);

    try {
      // Pass 1: セグメント名と売上高の特定
      const embResTable = await fetch(EMBED_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "bge-m3", prompt: "セグメント情報 事業別 報告 計 | 収益" })
      }).then(r => r.json());

      const searchResTable = await qdrant.search("earnings_reports", {
        vector: embResTable.embedding,
        limit: 5,
        filter: { must: [{ key: "ticker", match: { value: ticker5 } }] },
        with_payload: true
      });

      let pass1Text = searchResTable.map(hit => hit.payload?.text || "").join("\n");
      if (!pass1Text.trim()) pass1Text = "申し訳ありませんが、テキストが提供されていません。";

      let llmText1 = await askLLM(pass1PromptTemplate(pass1Text), true);
      console.log("Raw LLM Text:\n" + llmText1);
      
      const arrayMatch = llmText1.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        llmText1 = arrayMatch[0];
      } else {
        llmText1 = llmText1.replace(/```json/g, "").replace(/```/g, "").trim();
      }
      
      let segmentsData = [];
      try {
        segmentsData = JSON.parse(llmText1);
        if (!Array.isArray(segmentsData)) segmentsData = [segmentsData];
      } catch (e) {
        // Error is handled below by fallback
      }

      const segmentNames = segmentsData.map((s: any) => s.segment).filter((n: string) => n && n.trim() !== "");
      
      let summary = "";
      let mainSegmentJson = "";
  let subSegmentsJson = "";
      
      const shikihoTicker = ticker5.substring(0, 4);
      const shikihoRes = await db.execute({
        sql: "SELECT index_summary, index_keywords FROM shikiho_profiles WHERE ticker = ? OR ticker = ?",
        args: [ticker5, shikihoTicker]
      });
      let indexKeywords = "";
      let indexSummary = "";
      let refInfo = "";
      if (shikihoRes.rows.length > 0) {
        const row = shikihoRes.rows[0];
        indexKeywords = String(row.index_keywords);
        indexSummary = String(row.index_summary);
        refInfo = `【参考情報】\n**事業概要:**\n${indexSummary}\n\n**機能的価値 (キーワード):**\n${indexKeywords}\n`;
      }

      if (segmentNames.length === 0) {
        console.log(`-> [Fallback] セグメント抽出不能のため、統合プロンプト（Plan 1）に移行`);
        const embResText = await fetch(EMBED_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "bge-m3", prompt: "報告セグメント 概要 事業内容 製品 サービス" })
        }).then(r => r.json());

        let earningsText = "";
        try {
          const searchResText = await qdrant.search("earnings_reports", {
            vector: embResText.embedding,
            limit: 3,
            filter: { must: [{ key: "ticker", match: { value: ticker5 } }] },
            with_payload: true
          });
          earningsText = searchResText.map(hit => hit.payload?.text || "").join("\n");
        } catch(e) {
          earningsText = "テキストなし";
        }

        let finalOutput = await askLLM(unifiedPromptTemplate(companyName, ticker5, indexSummary, indexKeywords, earningsText), false);
        summary = finalOutput.replace(/^事業要約[：:]\s*/, "").trim();
        // If fallback occurs, there is no mainSegmentJson
      } else {
        // Pass 2: 事業内容の深掘り
        const embResText = await fetch(EMBED_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "bge-m3", prompt: "報告セグメント 概要 事業内容 製品 サービス" })
        }).then(r => r.json());

        const searchResText = await qdrant.search("earnings_reports", {
          vector: embResText.embedding,
          limit: 3,
          filter: { must: [{ key: "ticker", match: { value: ticker5 } }] },
          with_payload: true
        });

        let pass2Text = searchResText.map(hit => hit.payload?.text || "").join("\n");
        let llmText2 = await askLLM(pass2PromptTemplate(segmentNames, pass2Text), true);
        llmText2 = llmText2.replace(/^```(json)?/, "").replace(/```$/, "").trim();
        
        let descriptionsData = [];
        try {
          descriptionsData = JSON.parse(llmText2);
          if (!Array.isArray(descriptionsData)) descriptionsData = [descriptionsData];
        } catch (e) {
          console.error(`[Error] Pass 2 JSON Parse Failed for ${companyName}.`);
        }

        const mergedSegments = segmentsData.map((s1: any) => {
          const descObj = descriptionsData.find((s2: any) => s2.segment === s1.segment);
          return {
            segment: s1.segment,
            revenue: s1.revenue,
            description: descObj ? descObj.description : "記載なし"
          };
        });

        let maxSegment = mergedSegments[0];
        for (const s of mergedSegments) {
          const revValueS = parseInt(String(s.revenue).replace(/[^0-9]/g, "")) || 0;
          const revValueMax = parseInt(String(maxSegment.revenue).replace(/[^0-9]/g, "")) || 0;
          if (revValueS > revValueMax) maxSegment = s;
        }
        let otherSegments = mergedSegments.filter((s: any) => s.segment !== maxSegment.segment);
        otherSegments.sort((a: any, b: any) => {
          const revA = parseInt(String(a.revenue).replace(/[^0-9]/g, "")) || 0;
          const revB = parseInt(String(b.revenue).replace(/[^0-9]/g, "")) || 0;
          return revB - revA;
        });
        
        // Keep up to 2 sub segments
        otherSegments = otherSegments.slice(0, 2);

        let finalOutput = await askLLM(step2PromptTemplate(companyName, ticker5, refInfo, maxSegment, otherSegments), false);
        summary = finalOutput.replace(/^事業要約[：:]\s*/, "").trim();
        mainSegmentJson = JSON.stringify(maxSegment);
        subSegmentsJson = JSON.stringify(otherSegments);
      }

      console.log(`=> Summary: ${summary}`);

      if (summary) {
        await db.execute({
          sql: "UPDATE equities_master SET summary = ?, main_segment = ?, sub_segments = ? WHERE ticker = ?",
          args: [summary, mainSegmentJson || null, subSegmentsJson || null, ticker5]
        });

        let mainSegmentText = "";
        let subSegmentText = "";
        try {
          if (mainSegmentJson) {
            const m = JSON.parse(mainSegmentJson);
            mainSegmentText = `セグメント名: ${m.segment}\n説明: ${m.description}`;
          }
          if (subSegmentsJson) {
            const subs = JSON.parse(subSegmentsJson);
            subSegmentText = subs.map((s: any) => `セグメント名: ${s.segment}\n説明: ${s.description}`).join("\n---\n");
          }
        } catch (e) {}

        const qdrantText = `【事業要約】\n${summary}\n\n【機能的価値キーワード】\n${indexKeywords}\n\n【メイン事業】\n${mainSegmentText}\n\n【サブ事業】\n${subSegmentText}`;
        const embedRes = await fetch(EMBED_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "bge-m3", prompt: qdrantText })
        }).then(r => r.json());

        try {
          await qdrant.upsert("company_profiles", {
            wait: true,
            points: [
              {
                id: generateUuidForTicker(ticker5),
                vector: embedRes.embedding,
                payload: {
                  ticker: ticker5,
                  name: companyName,
                  summary: summary,
                  keywords: indexKeywords,
                  text: qdrantText
                }
              }
            ]
          });
          console.log(`=> Saved vectors to Qdrant (company_profiles).`);
        } catch (qErr) {
          console.error(`[Warning] Failed to save to Qdrant:`, qErr);
        }
      }

    } catch (e) {
      console.error(`[Error] Exception during processing ${companyName}:`, e);
    }
  }

  console.log("Batch processing complete.");
}

// Simple helper to generate a deterministic UUID-like string from a ticker
function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

main().catch(console.error);
