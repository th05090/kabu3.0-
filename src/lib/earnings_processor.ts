import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { scrapeIRBank } from '../scripts/fetch_pdf';
import { askLLM, pass2PromptTemplate, step2PromptTemplate, unifiedPromptTemplate } from '../scripts/rag/theme_prompts';
import { runStage1, runStage2, runStage3, embedOllama } from './segment_extractor';
import { reclassifyGics } from './gics';
import { generateAiReport } from '../scripts/analyze_stock_rag';

const execAsync = promisify(exec);
const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });
const EMBED_URL = "http://localhost:11434/api/embeddings";

function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

async function waitForVram(minFreeGb: number = 3.0, maxWaitMs: number = 30000): Promise<void> {
  const start = Date.now();
  console.log(`[VRAM Check] Waiting for at least ${minFreeGb}GB free VRAM...`);
  
  while (Date.now() - start < maxWaitMs) {
    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits');
      const freeMb = parseInt(stdout.trim());
      if (!isNaN(freeMb) && freeMb > minFreeGb * 1024) {
        console.log(`[VRAM Check] Free VRAM is ${freeMb} MB. Proceeding.`);
        return;
      }
      console.log(`[VRAM Check] Only ${freeMb} MB free, waiting...`);
    } catch (e) {
      console.log(`[VRAM Check] nvidia-smi failed, skipping check.`);
      return;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`[VRAM Check] Timed out waiting for VRAM. Proceeding anyway.`);
}

export async function processEarningsReports(onProgress?: (msg: string) => void, targetTickers?: string[]) {
  console.log("--- Starting Earnings PDF Processing ---");

  let query = `
    SELECT f.ticker, MAX(f.date) as latest_date, e.main_segment, e.sub_segments, e.name, e.summary, e.theme_keywords
    FROM financials f
    JOIN equities_master e ON f.ticker = e.ticker
    WHERE e.name NOT LIKE '%ETF%'
      AND e.name NOT LIKE '%ETN%'
      AND e.name NOT LIKE '%REIT%'
      AND e.name NOT LIKE '%投資法人%'
      AND e.name NOT LIKE '%証券投資%'
      AND e.name NOT LIKE '%ファンド%'
      AND e.name NOT LIKE '%ＥＴＦ%'
  `;
  let args: any[] = [];
  
  if (targetTickers && targetTickers.length > 0) {
    const placeholders = targetTickers.map(() => '?').join(',');
    query += ` AND f.ticker IN (${placeholders}) `;
    args.push(...targetTickers);
  }
  
  query += ` GROUP BY f.ticker`;
  
  const result = await db.execute({ sql: query, args });
  const rowsToProcess = result.rows;
  const total = rowsToProcess.length;

  let phase1Count = 0;
  let phase2Count = 0;

  // ---------------------------------------------------------
  // PHASE 1: Fetch PDF & Docling to MD (GPU/CPU)
  // ---------------------------------------------------------
  console.log(`\n=== Phase 1: PDF Fetch & Docling Parsing (${total} items) ===`);
  for (let i = 0; i < total; i++) {
    const row = rowsToProcess[i];
    const ticker = String(row.ticker);
    const date = String(row.latest_date);
    const tickerPdfDir = path.join(process.cwd(), 'data', 'pdfs', ticker);
    const pdfPath = path.join(tickerPdfDir, `${ticker}_${date}.pdf`);
    const mdPath = path.join(tickerPdfDir, `${ticker}_${date}.md`);
    const ignorePath = path.join(tickerPdfDir, `.ignore_${date}`);

    if ((existsSync(pdfPath) && existsSync(mdPath)) || existsSync(ignorePath)) {
      continue;
    }

    console.log(`\n[*] [Phase 1: ${i+1}/${total}] Processing ${row.name} (${ticker}) on ${date}`);
    if (onProgress) onProgress(`[フェーズ1: ${i+1}/${total}] PDF取得・解析中: ${row.name} (${ticker})...`);

    try {
      console.log(`  [1/2] Fetching PDF from IR BANK...`);
      const fetchedPdfPath = await scrapeIRBank(ticker, date);

      if (!fetchedPdfPath) {
        console.error(`  => No valid 決算短信 found on IR Bank for ${ticker}`);
        await fs.writeFile(ignorePath, "");
        continue;
      }

      // Check if MD exists for this actual path
      const actualDate = path.basename(fetchedPdfPath, '.pdf').split('_')[1];
      
      // If actual IR Bank date is different from J-Quants date, J-Quants date was likely a revision.
      if (actualDate !== date) {
        await fs.writeFile(ignorePath, "");
      }

      const mdPathReal = path.join(tickerPdfDir, `${ticker}_${actualDate}.md`);

      if (!existsSync(mdPathReal)) {
        console.log(`  [2/2] Converting PDF to Markdown (Docling)...`);
        await waitForVram(3.0);
        try {
          await execAsync(`python src/scripts/pdf_to_md_docling.py "${fetchedPdfPath}" "${mdPathReal}"`);
          console.log(`  => [DOCLING_MODE: ${ticker}] GPU`);
        } catch (e: any) {
          console.error(`  => [Warning] Docling failed or truncated. Falling back to CPU...`);
          if (onProgress) onProgress(`[フェーズ1: ${i+1}/${total}] VRAM枯渇・欠落検知、CPUモードで再実行中 (約1分かかります)...`);
          await execAsync(`python src/scripts/pdf_to_md_docling.py "${fetchedPdfPath}" "${mdPathReal}" --cpu`);
          console.log(`  => [DOCLING_MODE: ${ticker}] CPU Fallback`);
        }
      } else {
        console.log(`  => MD already exists for ${actualDate}. Skipping Docling.`);
      }
      phase1Count++;
    } catch (err: any) {
      console.error(`  [Error] Failed to process ${ticker} in Phase 1:`, err.message);
    }
  }

  // ---------------------------------------------------------
  // PHASE 2: Embed, RAG Extraction, and AI Report (LLM)
  // ---------------------------------------------------------
  console.log(`\n=== Phase 2: AI Parsing and DB Update (${total} items) ===`);
  for (let i = 0; i < total; i++) {
    const row = rowsToProcess[i];
    const ticker = String(row.ticker);
    const tickerPdfDir = path.join(process.cwd(), 'data', 'pdfs', ticker);
    
    // Find the latest MD file in the directory (excluding newbiz)
    let mdFiles: string[] = [];
    try {
      const files = await fs.readdir(tickerPdfDir);
      mdFiles = files.filter(f => f.startsWith(`${ticker}_`) && f.endsWith('.md') && !f.includes('_newbiz_'))
                     .sort().reverse();
    } catch(e) {}

    if (mdFiles.length === 0) {
      console.log(`  => Skipping ${ticker} in Phase 2 because no Markdown found.`);
      continue;
    }

    const latestMdFile = mdFiles[0];
    const mdPath = path.join(tickerPdfDir, latestMdFile);
    const pdfPath = path.join(tickerPdfDir, latestMdFile.replace('.md', '.pdf'));
    const actualDate = latestMdFile.replace(`${ticker}_`, '').replace('.md', '');

    if (existsSync(pdfPath + ".done")) {
      continue;
    }

    console.log(`\n[*] [Phase 2: ${i+1}/${total}] AI Analysis for ${row.name} (${ticker})`);
    if (onProgress) onProgress(`[フェーズ2: ${i+1}/${total}] AI決算解析中: ${row.name} (${ticker})...`);

    try {
      console.log(`  [1/4] Embedding Markdown into Qdrant...`);
      await execAsync(`npx tsx src/scripts/embed_markdown.ts ${ticker} ${actualDate}`);

      console.log(`  [2/4] Extracting Segment Info via RAG (Gemma 4)...`);
      let markdown = "";
      try {
        markdown = await fs.readFile(mdPath, 'utf-8');
      } catch (e: any) {
        console.error(`  => [Warning] Markdown file read failed: ${e.message}`);
      }

      // Phase 1: 3-Stage Extraction (from SPEC.md)
      let segmentsData = runStage1(markdown);
      let extractionStage = "Stage 1 (Table)";
      
      if (!segmentsData) {
          segmentsData = runStage2(markdown);
          extractionStage = "Stage 2 (Regex)";
          if (!segmentsData) {
              segmentsData = await runStage3(ticker, qdrant);
              extractionStage = segmentsData ? "Stage 3 (Qdrant)" : "Failed (Fallback to Plan 1)";
          }
      }
      console.log(`  => Extraction Stage: ${extractionStage}`);
      
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
      const shikihoTicker = ticker.substring(0, 4);
      const shikihoRes = await db.execute({
        sql: "SELECT index_summary, index_keywords FROM shikiho_profiles WHERE ticker = ? OR ticker = ?",
        args: [ticker, shikihoTicker]
      });
      let indexKeywords = row.theme_keywords ? String(row.theme_keywords) : "";
      let indexSummary = "";
      let refInfo = "";
      if (shikihoRes.rows.length > 0) {
        const shRow = shikihoRes.rows[0];
        if (shRow.index_keywords) indexKeywords = String(shRow.index_keywords);
        indexSummary = String(shRow.index_summary);
        refInfo = `【参考情報】\n**事業概要:**\n${indexSummary}\n\n**機能的価値 (キーワード):**\n${indexKeywords}\n`;
      }

      let summary = row.summary ? String(row.summary) : "";
      let mainSegmentJson = "";
      let subSegmentsJson = "";

      // Phase 2: Dynamic Pass 2 or Plan 1
      if (segmentNames.length === 0) {
        console.log(`  => [Fallback] No segments found. Running Unified Prompt (Plan 1).`);
        const embResText = await embedOllama("bge-m3", "報告セグメント 概要 事業内容 製品 サービス");
        let earningsText = "";
        try {
          const searchResText = await qdrant.search("earnings_reports", {
            vector: embResText.embedding,
            limit: 3,
            filter: { must: [{ key: "ticker", match: { value: ticker } }] }
          });
          earningsText = searchResText.map(hit => hit.payload?.text || "").join("\n");
        } catch(e) {
          earningsText = "テキストなし";
        }
        let finalOutput = await askLLM(unifiedPromptTemplate(String(row.name), ticker, indexSummary, indexKeywords, earningsText), false);
        summary = finalOutput.replace(/^事業要約[：:]\s*/, "").trim();
      } else {
        console.log(`  => Running Pass 2 (Dynamic Query per Segment)...`);
        const uniqueChunks = new Map<string, string>();
        for (const segment of segmentNames) {
            const query = `${segment} 事業内容 概要 製品 サービス`;
            const embed = await embedOllama("bge-m3", query);
            const searchRes = await qdrant.search('earnings_reports', {
                vector: embed.embedding,
                limit: 2,
                filter: { must: [{ key: 'ticker', match: { value: ticker } }] }
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
          console.error(`  => [Warning] Pass 2 JSON Parse Failed.`);
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

        console.log(`  => Running Step 2 Unified Summary...`);
        let finalOutput = await askLLM(step2PromptTemplate(String(row.name), ticker, refInfo, maxSegment, otherSegments), false);
        summary = finalOutput.replace(/^事業要約[：:]\s*/, "").trim();
        
        mainSegmentJson = JSON.stringify(maxSegment);
        subSegmentsJson = JSON.stringify(otherSegments);
      }

      console.log(`  [3/4] Updating DB and GICS...`);
      // 冪等性を担保するため、.doneが未作成の銘柄は常にDB・GICS・Qdrantを上書き更新する
      await db.execute({
        sql: "UPDATE equities_master SET summary = ?, main_segment = ?, sub_segments = ? WHERE ticker = ?",
        args: [summary, mainSegmentJson || "{}", subSegmentsJson || "[]", ticker]
      });

      const gicsResult = await reclassifyGics(ticker);
      if (gicsResult.success) {
        console.log(`  => Successfully reclassified GICS: ${gicsResult.theme}`);
      } else {
        console.error(`  => Failed to reclassify GICS: ${gicsResult.error}`);
      }

      // Update Qdrant Vector
      const indexKeywords = row.theme_keywords ? String(row.theme_keywords) : "";
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

      await qdrant.upsert("company_profiles", {
        wait: true,
        points: [
          {
            id: generateUuidForTicker(ticker),
            vector: embedRes.embedding,
            payload: {
              ticker: ticker,
              name: String(row.name),
              summary: summary,
              keywords: indexKeywords,
              text: qdrantText
            }
          }
        ]
      });
      console.log(`  => Successfully updated Qdrant vector for ${ticker}`);

      console.log(`  [4/4] Generating AI Analyst Report...`);
      
      let prevPdfPath = "";
      let prevMdPath = "";
      if (mdFiles.length > 1) {
        const prevMdFile = mdFiles[1];
        prevMdPath = path.join(tickerPdfDir, prevMdFile);
        prevPdfPath = path.join(tickerPdfDir, prevMdFile.replace('.md', '.pdf'));
      }
      
      if (!prevPdfPath || !existsSync(prevPdfPath) || !existsSync(prevMdPath)) {
        console.log(`  => Previous PDF or MD not found. Proceeding with single-report AI generation.`);
        prevPdfPath = "";
      }

      await generateAiReport(ticker, prevPdfPath, pdfPath, onProgress);
      await fs.writeFile(pdfPath + ".done", new Date().toISOString());

      phase2Count++;
    } catch (err: any) {
      console.error(`  [Error] Failed to process ${ticker} in Phase 2:`, err.message);
    }
  }

  console.log(`\n--- Earnings Processing Complete (Phase1: ${phase1Count}, Phase2: ${phase2Count}) ---`);
}

