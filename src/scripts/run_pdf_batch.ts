import { createClient } from '@libsql/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

const HISTORY_FILE = path.join(process.cwd(), 'data', 'pdf_batch_history.json');

interface BatchHistory {
  [ticker: string]: {
    status: 'success' | 'error' | 'skipped';
    timestamp: string;
    errorMsg?: string;
  };
}

async function loadHistory(): Promise<BatchHistory> {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveHistory(history: BatchHistory) {
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.length > 0 ? parseInt(args[0], 10) : 4000;

  console.log('--- PDF Batch Pipeline Started ---');
  console.log(`Target Limit: ${limit} companies`);

  // 1. Get tickers from equities_master
  const res = await db.execute(`
    SELECT ticker 
    FROM equities_master 
    WHERE (gics_sub_industry_id IS NULL OR (gics_sub_industry_id NOT LIKE '98%' AND gics_sub_industry_id NOT LIKE '99%'))
    ORDER BY ticker ASC
  `);
  const allTickers = res.rows.map(r => r.ticker as string);
  console.log(`Total tickers in DB: ${allTickers.length}`);

  // 2. Load History
  const history = await loadHistory();
  const processedCount = Object.values(history).filter(h => h.status === 'success').length;
  console.log(`Already processed (success): ${processedCount}`);

  // 3. Process each ticker
  let processedInThisRun = 0;

  for (const ticker of allTickers) {
    if (processedInThisRun >= limit) {
      console.log(`Reached limit of ${limit} companies for this run.`);
      break;
    }

    if (history[ticker] && history[ticker].status === 'success') {
      continue; // Skip already successfully processed
    }

    console.log(`\n=========================================`);
    console.log(`Processing [${ticker}] (${processedInThisRun + 1}/${limit})`);
    console.log(`=========================================`);

    try {
      const pdfPath = path.join(process.cwd(), 'data', 'pdfs', `${ticker}_latest.pdf`);
      const mdPath = path.join(process.cwd(), 'data', 'md', `${ticker}_latest.md`);

      // Cleanup existing files to avoid false positives
      await fs.rm(pdfPath, { force: true }).catch(() => {});
      await fs.rm(mdPath, { force: true }).catch(() => {});

      // Step A: Fetch PDF
      console.log(`[Step A] Fetching PDF...`);
      await execAsync(`npx tsx src/scripts/fetch_pdf.ts ${ticker}`);
      
      try {
        await fs.access(pdfPath);
      } catch {
        throw new Error(`PDF not found after fetch. (Skipped or no PDF available)`);
      }

      // Step B: Docling (PDF to MD)
      console.log(`[Step B] Converting PDF to Markdown (Docling)...`);
      await execAsync(`python src/scripts/pdf_to_md_docling.py "${pdfPath}" "${mdPath}"`);

      try {
        await fs.access(mdPath);
      } catch {
        throw new Error(`Markdown not found after Docling conversion.`);
      }

      // Step C: Embed Markdown
      console.log(`[Step C] Embedding Markdown into Qdrant...`);
      await execAsync(`npx tsx src/scripts/embed_markdown.ts ${ticker} latest`);

      // Success
      history[ticker] = {
        status: 'success',
        timestamp: new Date().toISOString()
      };
      console.log(`[Result] Successfully processed ${ticker}.`);

    } catch (error: any) {
      console.error(`[Error] Failed processing ${ticker}: ${error.message}`);
      history[ticker] = {
        status: 'error',
        timestamp: new Date().toISOString(),
        errorMsg: error.message
      };
    }

    // Save history periodically (every ticker to avoid data loss)
    await saveHistory(history);
    processedInThisRun++;
  }

  console.log('\n--- PDF Batch Pipeline Completed ---');
}

main().catch(console.error);
