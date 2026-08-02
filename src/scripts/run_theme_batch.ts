import { createClient } from "@libsql/client";
import { QdrantClient } from "@qdrant/js-client-rest";
import fs from 'fs';
import path from 'path';
import { askLLM, pass2PromptTemplate, step2PromptTemplate, unifiedPromptTemplate } from "./rag/theme_prompts.js";

const DB_URL = "file:local.db";
const EMBED_URL = "http://localhost:11434/api/embeddings";
const QDRANT_URL = "http://localhost:6333";
const EMBED_MODEL = "bge-m3";

// Helper for Ollama Embeddings
async function embedOllama(model: string, prompt: string) {
    const res = await fetch(EMBED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt })
    });
    if (!res.ok) throw new Error("Embed failed");
    return await res.json();
}

// ---------------- Stage 1: Markdown Table Parsing ----------------
function parseMarkdownTable(markdownTable: string) {
  const lines = markdownTable.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
  const dataLines = lines.filter(l => !l.replace(/\|/g, '').match(/^[\s\-\:]+$/));
  
  const grid = dataLines.map(line => {
    let cols = line.split('|');
    cols.shift(); 
    if (cols.length > 0 && cols[cols.length - 1].trim() === '') cols.pop();
    return cols.map(c => c.replace(/\s+/g, ''));
  });
  if (grid.length === 0) return null;

  let targetRow = -1, targetCol = -1, isTransposed = false;
  const revenueKeywords = ["外部顧客", "顧客との契約", "売上高", "営業収益", "売上収益", "収益"];
  
  for (let keyword of revenueKeywords) {
    for (let r = 0; r < grid.length; r++) {
      if (grid[r][0] && grid[r][0].includes(keyword)) {
        targetRow = r; isTransposed = true; break;
      }
    }
    if (targetRow !== -1) break;
  }
  if (targetRow === -1) {
    for (let keyword of revenueKeywords) {
      for (let r = 0; r < Math.min(2, grid.length); r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c] && grid[r][c].includes(keyword)) {
            targetCol = c; isTransposed = false; break;
          }
        }
        if (targetCol !== -1) break;
      }
      if (targetCol !== -1) break;
    }
  }

  const results = [];
  const excludeRegex = /計|合計|調整額|全社|その他|消去|連結|損益計算書/;

  if (isTransposed && targetRow !== -1) {
    for (let c = 1; c < grid[0].length; c++) {
      let segName = '';
      for (let r = 0; r < targetRow; r++) {
        const cell = grid[r][c] ? grid[r][c].trim() : '';
        if(cell && !cell.includes('報告セグメント') && !cell.includes('セグメント情報') && !/^[\d,\.\-\+－]+$/.test(cell)) {
          segName += cell;
        }
      }
      if (!segName) continue;
      if (excludeRegex.test(segName)) break;
      
      const revenueStr = grid[targetRow][c] || "";
      if (revenueStr) {
        results.push({ segment: segName, revenue: revenueStr });
      }
    }
  } else if (!isTransposed && targetCol !== -1) {
    for (let r = 1; r < grid.length; r++) {
      let segName = grid[r][0];
      if (!segName) continue;
      if (excludeRegex.test(segName)) break;
      
      const revenueStr = grid[r][targetCol] || "";
      if (revenueStr) {
        results.push({ segment: segName, revenue: revenueStr });
      }
    }
  }
  return results.length > 0 ? results : null;
}

function runStage1(markdown: string) {
  const tableRegex = /\|?[^\n]*?(?:報告セグメント|セグメント情報|事業部門|セグメント)[^\n]*?\|?\r?\n[ \|\-:]+\r?\n(?:\|?[^\n]*?\|?\r?\n)+/g;
  const matches = markdown.match(tableRegex);
  if (!matches) return null;
  for (const match of matches) {
      const parsed = parseMarkdownTable(match);
      if (parsed) return parsed;
  }
  return null;
}

// ---------------- Stage 2: Single Segment Regex ----------------
function runStage2(markdown: string) {
  const regexes = [
    /(?:当社グループの事業セグメントは|当社グループの報告セグメントは|当社グループは|当社は)(?:、)?(?:「)?([^、。「」\n]+?)(?:」)?(?:事業)?の?単一(?:の)?(?:セグメント|事業)[^、。\n]*?である(?:ため|り)/,
    /(?:当社グループは|当社は)(?:、)?([^、。「」\n]+?)(?:事業)?のみの単一(?:の)?(?:セグメント|事業)/
  ];
  for (const regex of regexes) {
    const m = markdown.match(regex);
    if (m && m[1]) {
      let segName = m[1].replace(/\s+/g, '').replace(/事業$/, '') + '事業';
      if (segName.includes("当社")) continue;
      return [{ segment: segName, revenue: "N/A (Single)" }];
    }
  }
  return null;
}

// ---------------- Stage 3: Qdrant + LLM Fallback ----------------
async function runStage3(ticker: string, qdrant: QdrantClient) {
    let embedRes;
    try {
        embedRes = await embedOllama(EMBED_MODEL, "セグメント情報 事業別 報告 計 | 収益");
    } catch(e) {
        return null;
    }

    let searchRes;
    try {
        searchRes = await qdrant.search('earnings_reports', { 
            vector: embedRes.embedding, 
            limit: 3,
            filter: { must: [{ key: 'ticker', match: { value: ticker } }] }
        });
    } catch(e) {
        return null;
    }
    
    if (!searchRes || searchRes.length === 0) return null;
    
    const context = searchRes.map((r: any, i: number) => `【Chunk ${i + 1}】\n${r.payload.text}`).join('\n\n');
    
    const prompt = `あなたは企業の決算説明資料から、事業セグメントとその売上高を抽出する専門家です。
以下のテキストから、報告されている事業セグメント名と、その売上高（または収益）を抽出してください。

【厳格なルール】
- 以下のフォーマットの箇条書きテキストとして出力してください。余計な文章は一切含めないでください。
  - セグメント: [セグメント名], 売上高: [数値]
  - セグメント: [セグメント名], 売上高: [数値]
- 「国内」「海外」「日本」「北米」などの地域別売上や、「第1四半期」「上期」などの期間別データ、または「売上高」「営業利益」などの単なる勘定科目しかない場合は、セグメント情報ではないため、絶対に「なし」とだけ出力してください。
- 該当するセグメント情報が見つからない場合も「なし」と出力してください。

【テキスト】
${context}`;

    let textOutput = "";
    try {
      textOutput = await askLLM(prompt, false); // format false means plain text
    } catch (e) {
      return null;
    }
    
    if (textOutput.includes("なし") && !textOutput.includes("セグメント:")) {
        return null;
    }
    
    const regex = /\-\s*セグメント:\s*(.+?),\s*売上高:\s*([\d,]+)/g;
    let match;
    const segments = [];
    const excludeRegex = /計|合計|調整額|全社|その他|消去|連結|損益計算書/; // Filters out totals

    while ((match = regex.exec(textOutput)) !== null) {
        const segName = match[1].trim();
        if (excludeRegex.test(segName)) {
            console.log(`[Stage 3 Filtered Out]: ${segName}`);
            continue; 
        }
        segments.push({ segment: segName, revenue: match[2].trim() });
    }
    
    return segments.length > 0 ? segments : null;
}

// Simple helper to generate a deterministic UUID-like string from a ticker
function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

// ---------------- MAIN BATCH ----------------
async function main() {
  const db = createClient({ url: DB_URL });
  const qdrant = new QdrantClient({ url: QDRANT_URL });

  try {
    await db.execute("ALTER TABLE equities_master ADD COLUMN theme TEXT");
    await db.execute("ALTER TABLE equities_master ADD COLUMN summary TEXT");
    await db.execute("ALTER TABLE equities_master ADD COLUMN main_segment TEXT");
  } catch (e) {
    // Column might already exist, ignore
  }

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

  const targetsResult = await db.execute(`
    SELECT ticker, name FROM equities_master 
    WHERE sub_segments IS NULL 
      AND market != 'TOKYO PRO MARKET'
      AND name NOT LIKE '%上場信託%'
      AND name NOT LIKE '%ETF%'
      AND name NOT LIKE '%ETN%'
      AND name NOT LIKE '%ＥＴＮ%'
      AND name NOT LIKE '%投資法人%'
      AND name NOT LIKE '%リート%'
      AND name NOT LIKE '%上場投信%'
      AND name NOT LIKE '%ファンド%'
      AND name NOT LIKE '%ＥＴＦ%'
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
      const pdfDir = path.join(process.cwd(), "data", "pdfs", ticker5);
      let markdown = "";
      try {
          if (fs.existsSync(pdfDir)) {
              const files = fs.readdirSync(pdfDir).filter(f => f.endsWith(".md"));
              if (files.length > 0) {
                  markdown = fs.readFileSync(path.join(pdfDir, files[0]), "utf-8");
              }
          }
      } catch (e) {
          console.error(`Warning: Could not read Markdown for ${ticker5}`);
      }

      // Phase 1: 3-Stage Extraction
      let segmentsData = runStage1(markdown);
      let extractionStage = "Stage 1 (Table)";
      
      if (!segmentsData) {
          segmentsData = runStage2(markdown);
          extractionStage = "Stage 2 (Regex)";
          if (!segmentsData) {
              segmentsData = await runStage3(ticker5, qdrant);
              extractionStage = segmentsData ? "Stage 3 (Qdrant)" : "Failed (Fallback to Plan 1)";
          }
      }

      console.log(`-> Extraction Stage: ${extractionStage}`);
      
      // Deduplicate segments
      if (segmentsData) {
           const seen = new Set();
           segmentsData = segmentsData.filter((s: any) => {
               if(seen.has(s.segment)) return false;
               seen.add(s.segment);
               return true;
           });
      }
      
      const segmentNames = (segmentsData || []).map((s: any) => s.segment).filter((n: string) => n && n.trim() !== "");

      // Get Shikiho Profile Reference Info
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

      let summary = "";
      let mainSegmentJson = "";
      let subSegmentsJson = "";

      // Phase 2: Dynamic Pass 2 or Plan 1
      if (segmentNames.length === 0) {
        console.log(`-> [Fallback] No segments found. Running Unified Prompt (Plan 1).`);
        
        const embResText = await embedOllama(EMBED_MODEL, "報告セグメント 概要 事業内容 製品 サービス");
        let earningsText = "";
        try {
          const searchResText = await qdrant.search("earnings_reports", {
            vector: embResText.embedding,
            limit: 3,
            filter: { must: [{ key: "ticker", match: { value: ticker5 } }] }
          });
          earningsText = searchResText.map(hit => hit.payload?.text || "").join("\n");
        } catch(e) {
          earningsText = "テキストなし";
        }
        
        let finalOutput = await askLLM(unifiedPromptTemplate(companyName, ticker5, indexSummary, indexKeywords, earningsText), false);
        summary = finalOutput.replace(/^事業要約[：:]\s*/, "").trim();
      } else {
        console.log(`-> Running Pass 2 (Dynamic Query per Segment)...`);
        const uniqueChunks = new Map<string, string>();
        for (const segment of segmentNames) {
            const query = `${segment} 事業内容 概要 製品 サービス`;
            const embed = await embedOllama(EMBED_MODEL, query);
            const searchRes = await qdrant.search('earnings_reports', {
                vector: embed.embedding,
                limit: 2,
                filter: { must: [{ key: 'ticker', match: { value: ticker5 } }] }
            });
            for (const hit of searchRes) {
                if (!uniqueChunks.has(String(hit.id))) uniqueChunks.set(String(hit.id), String(hit.payload?.text));
            }
        }

        const pass2Text = Array.from(uniqueChunks.values()).join("\n\n");
        
        let llmText2 = await askLLM(pass2PromptTemplate(segmentNames, pass2Text), true);
        llmText2 = llmText2.replace(/^```(json)?/, "").replace(/```$/, "").trim();
        
        let descriptionsData = [];
        try {
          descriptionsData = JSON.parse(llmText2);
          if (!Array.isArray(descriptionsData)) descriptionsData = [descriptionsData];
        } catch (e) {
          console.error(`[Error] Pass 2 JSON Parse Failed for ${companyName}.`);
        }

        const norm = (s: string) => String(s).replace(/\s+/g, '');

        const mergedSegments = segmentsData.map((s1: any) => {
          const descObj = descriptionsData.find((s2: any) => norm(s2.segment) === norm(s1.segment));
          return {
            segment: s1.segment,
            revenue: s1.revenue,
            description: descObj ? descObj.description : "記載なし"
          };
        });

        // Split into main and sub
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
        otherSegments = otherSegments.slice(0, 2); // max 2 subs

        console.log(`-> Running Step 2 Unified Summary...`);
        let finalOutput = await askLLM(step2PromptTemplate(companyName, ticker5, refInfo, maxSegment, otherSegments), false);
        summary = finalOutput.replace(/^事業要約[：:]\s*/, "").trim();
        
        mainSegmentJson = JSON.stringify(maxSegment);
        subSegmentsJson = JSON.stringify(otherSegments);
      }

      console.log(`=> Summary: ${summary}`);

      if (summary) {
        await db.execute({
          sql: "UPDATE equities_master SET summary = ?, main_segment = ?, sub_segments = ? WHERE ticker = ?",
          args: [summary, mainSegmentJson || "{}", subSegmentsJson || "[]", ticker5]
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
        const embedRes = await embedOllama(EMBED_MODEL, qdrantText);

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

main().catch(console.error);
