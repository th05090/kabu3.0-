import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { scrapeIRBank } from '../scripts/fetch_pdf';
import { askLLM, pass1PromptTemplate, pass2PromptTemplate } from '../scripts/rag/theme_prompts';
import { reclassifyGics } from './gics';

const execAsync = promisify(exec);
const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });
const EMBED_URL = "http://localhost:11434/api/embeddings";

export async function processEarningsReports(targetTicker?: string) {
  console.log("--- Starting Earnings PDF Processing ---");

  // Fetch tickers that have newly updated earnings_date
  let query = `
    SELECT f.ticker, MAX(f.date) as latest_date, e.main_segment, e.sub_segments, e.name
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
  
  if (targetTicker) {
    query += ` AND f.ticker = ? `;
    args.push(targetTicker);
  }
  
  query += ` GROUP BY f.ticker`;
  
  const result = await db.execute({ sql: query, args });

  let processedCount = 0;

  for (const row of result.rows) {
    const ticker = String(row.ticker);
    const date = String(row.latest_date);
    const tickerPdfDir = path.join(process.cwd(), 'data', 'pdfs', ticker);
    const pdfPath = path.join(tickerPdfDir, `${ticker}_${date}.pdf`);
    const mdPath = path.join(tickerPdfDir, `${ticker}_${date}.md`);

    if (existsSync(pdfPath)) {
      continue; // Already processed this earnings date
    }

    console.log(`\n[*] New Earnings Detected for ${row.name} (${ticker}) on ${date}`);

    try {
      // 1. Fetch PDF
      console.log(`  [1/5] Fetching PDF from IR BANK...`);
      const ticker4 = ticker.substring(0, 4);
      await scrapeIRBank(ticker4, date);

      // fetch_pdf now saves it to `data/pdfs/[ticker4]/[ticker4]_[date].pdf`
      // But we want it at `data/pdfs/[ticker]/[ticker]_[date].pdf` so we'll move it
      const fetchedPdfPath = path.join(process.cwd(), 'data', 'pdfs', ticker4, `${ticker4}_${date}.pdf`);
      if (!existsSync(fetchedPdfPath)) {
        console.error(`  => PDF fetch succeeded but file not found at ${fetchedPdfPath}`);
        continue;
      }

      await fs.mkdir(tickerPdfDir, { recursive: true });
      await fs.rename(fetchedPdfPath, pdfPath);

      // 2. Docling to MD
      console.log(`  [2/5] Converting PDF to Markdown (Docling)...`);
      await execAsync(`python src/scripts/pdf_to_md_docling.py "${pdfPath}" "${mdPath}"`);

      // 3. Embed to Qdrant
      console.log(`  [3/5] Embedding Markdown into Qdrant...`);
      // Warning: embed_markdown expects <ticker> <period>, we can just pass date as period
      await execAsync(`npx tsx src/scripts/embed_markdown.ts ${ticker} ${date}`);

      // 4. RAG Extraction
      console.log(`  [4/5] Extracting Segment Info via RAG (Gemma 3)...`);

      let pass1Text = "";
      try {
        const mdContent = await fs.readFile(mdPath, 'utf-8');
        const headingRegexes = [
          /\|?[^\n]*?(?:報告セグメント|セグメント情報)[^\n]*?\|?\n[ \|\-:]+\n[\s\S]*?(?:\n\n|$)/g,
          /\|?[^\n]*?(?:事業部門|セグメント)[^\n]*?\|?\n[ \|\-:]+\n[\s\S]*?(?:\n\n|$)/g
        ];
        
        for (const regex of headingRegexes) {
          const matches = mdContent.match(regex);
          if (matches) {
            pass1Text += matches.join('\n\n') + '\n\n';
          }
        }
        console.log(`  => Extracted content via regex for Pass 1.`);
      } catch(e: any) {
        console.error(`  => [Warning] Regex table extraction failed: ${e.message}`);
      }

      // Fallback to Qdrant if Regex failed to find tables
      if (!pass1Text.trim()) {
        console.log(`  => Fallback to Qdrant for Pass 1...`);
        const embResTable = await fetch(EMBED_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "bge-m3", prompt: "セグメント情報 事業別 報告 計 | 収益" })
        }).then(r => r.json());

        const searchResTable = await qdrant.search("earnings_reports", {
          vector: embResTable.embedding,
          limit: 5,
          filter: { must: [{ key: "ticker", match: { value: ticker } }, { key: "period", match: { value: date } }] },
          with_payload: true
        });

        pass1Text = searchResTable.map(hit => hit.payload?.text || "").join("\n");
      }

      if (!pass1Text.trim()) pass1Text = "該当するテキストがありません。";
      
      console.log(`[DEBUG] pass1Text length: ${pass1Text.length}`);

      let llmText1 = await askLLM(pass1PromptTemplate(pass1Text), true);
      console.log(`[DEBUG] llmText1: ${llmText1}`);
      const arrayMatch = llmText1.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) llmText1 = arrayMatch[0];
      else llmText1 = llmText1.replace(/^```(json)?/, "").replace(/```$/, "").trim();
      
      let segmentsData = [];
      try {
        segmentsData = JSON.parse(llmText1);
        if (!Array.isArray(segmentsData)) segmentsData = [segmentsData];
      } catch (e) {
        console.error(`  => [Warning] Pass 1 JSON Parse Failed.`);
        continue;
      }

      const segmentNames = segmentsData.map((s: any) => s.segment).filter((n: string) => n && n.trim() !== "");
      if (segmentNames.length === 0) {
        console.error(`  => [Warning] No segments extracted.`);
        continue;
      }

      const embResText = await fetch(EMBED_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "bge-m3", prompt: "報告セグメント 概要 事業内容 製品 サービス" })
      }).then(r => r.json());

      const searchResText = await qdrant.search("earnings_reports", {
        vector: embResText.embedding,
        limit: 3,
        filter: { must: [{ key: "ticker", match: { value: ticker } }, { key: "period", match: { value: date } }] },
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
        console.error(`  => [Warning] Pass 2 JSON Parse Failed.`);
      }

      const mergedSegments = segmentsData.map((s1: any) => {
        const descObj = descriptionsData.find((s2: any) => s2.segment === s1.segment);
        let revStr = String(s1.revenue).replace(/,/g, '');
        let revNum = parseFloat(revStr) || 0;
        return {
          segment: s1.segment,
          revenue: revNum,
          description: descObj ? descObj.description : "記載なし"
        };
      });

      mergedSegments.sort((a, b) => b.revenue - a.revenue);
      const maxSegment = mergedSegments[0];
      const otherSegments = mergedSegments.slice(1);

      // 5. Compare with existing
      let oldMainSegment: any = null;
      try {
        if (row.main_segment) {
          oldMainSegment = JSON.parse(String(row.main_segment));
        }
      } catch (e) {}

      const mainSegmentJson = JSON.stringify(maxSegment);
      const subSegmentsJson = JSON.stringify(otherSegments);

      const hasChanged = !oldMainSegment || oldMainSegment.segment !== maxSegment.segment || oldMainSegment.description !== maxSegment.description;

      if (hasChanged) {
        console.log(`  [5/5] Segment changed! Updating DB and reclassifying GICS...`);
        console.log(`    Old: ${oldMainSegment?.segment || "None"} -> New: ${maxSegment.segment}`);
        
        await db.execute({
          sql: "UPDATE equities_master SET main_segment = ?, sub_segments = ? WHERE ticker = ?",
          args: [mainSegmentJson, subSegmentsJson, ticker]
        });

        // Reclassify GICS
        const gicsResult = await reclassifyGics(ticker);
        if (gicsResult.success) {
          console.log(`  => Successfully reclassified GICS: ${gicsResult.theme}`);
        } else {
          console.error(`  => Failed to reclassify GICS: ${gicsResult.error}`);
        }
      } else {
        console.log(`  [5/5] Segment unchanged. No GICS reclassification needed.`);
      }

      processedCount++;
    } catch (err: any) {
      console.error(`  [Error] Failed to process ${ticker}:`, err.message);
    }
  }

  console.log(`\n--- Earnings PDF Processing Complete (${processedCount} processed) ---`);
}
