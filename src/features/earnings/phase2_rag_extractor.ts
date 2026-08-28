import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { askLLM, pass2PromptTemplate, step2PromptTemplate, unifiedPromptTemplate } from '../../scripts/rag/theme_prompts';
import { runStage1, runStage2, runStage3, embedOllama } from '../../lib/segment_extractor';
import { reclassifyGics } from '../gics/classifier';

const execAsync = promisify(exec);
const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });
const EMBED_URL = "http://localhost:11434/api/embeddings";

function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

export async function runPhase2(rowsToProcess: any[], total: number, onProgress?: (msg: string) => void): Promise<number> {
  let phase2Count = 0;
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
        let finalOutput = await askLLM(unifiedPromptTemplate(String(row.name), ticker, indexSummary, indexKeywords, earningsText), true);
        try {
          const parsed = JSON.parse(finalOutput);
          summary = parsed.summary ? parsed.summary.trim() : finalOutput;
        } catch(e) {
          summary = finalOutput;
        }
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
        
        let descriptionsData: any = [];
        try {
          const parsed = JSON.parse(llmText2);
          descriptionsData = parsed.segments || parsed;
          if (!Array.isArray(descriptionsData)) descriptionsData = [descriptionsData];
        } catch (e) {
          console.error(`  => [Warning] Pass 2 JSON Parse Failed.`);
        }

        const norm = (s: string) => String(s).replace(/\s+/g, '');
        const mergedSegments = (segmentsData || []).map((s1: any) => {
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
        let finalOutput = await askLLM(step2PromptTemplate(String(row.name), ticker, refInfo, maxSegment, otherSegments), true);
        try {
          const parsed = JSON.parse(finalOutput);
          summary = parsed.summary ? parsed.summary.trim() : finalOutput;
        } catch(e) {
          summary = finalOutput;
        }
        
        mainSegmentJson = JSON.stringify(maxSegment);
        subSegmentsJson = JSON.stringify(otherSegments);
      }

      console.log(`  [3/4] Updating DB and GICS...`);
      // 冪等性を担保するため、.doneが未作成の銘柄は常にDB・GICS・Qdrantを上書き更新する
      await db.execute({
        sql: "UPDATE equities_master SET summary = ?, main_segment = ?, sub_segments = ?, theme_keywords = ? WHERE ticker = ?",
        args: [summary, mainSegmentJson || "{}", subSegmentsJson || "[]", indexKeywords, ticker]
      });

      const gicsResult = await reclassifyGics(ticker);
      if (gicsResult.success) {
        console.log(`  => Successfully reclassified GICS: ${gicsResult.theme}`);
      } else {
        console.error(`  => Failed to reclassify GICS: ${gicsResult.error}`);
      }

      // Update Qdrant Vector
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

      console.log(`  [4/4] Generating AI Analyst Report (SKIPPED in Data Sync)...`);
      
      await fs.writeFile(pdfPath + ".done", new Date().toISOString());

      phase2Count++;
    } catch (err: any) {
      console.error(`  [Error] Failed to process ${ticker} in Phase 2:`, err.message);
    }
  }
  return phase2Count;
}
