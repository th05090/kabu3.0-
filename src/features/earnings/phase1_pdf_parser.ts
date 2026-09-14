import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { scrapeIRBank } from '../../scripts/fetch_pdf';

const execAsync = promisify(exec);

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

export interface Phase1Result {
  phase1Count: number;
  newItems: { ticker: string; date: string }[];
}

export async function runPhase1(rowsToProcess: any[], total: number, onProgress?: (msg: string) => void): Promise<Phase1Result> {
  let phase1Count = 0;
  const newItems: { ticker: string; date: string }[] = [];
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
      newItems.push({ ticker, date: actualDate });
    } catch (err: any) {
      console.error(`  [Error] Failed to process ${ticker} in Phase 1:`, err.message);
    }
  }
  return { phase1Count, newItems };
}
