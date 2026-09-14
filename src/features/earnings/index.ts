import { createClient } from '@libsql/client';
import { runPhase1 } from './phase1_pdf_parser';
import { runPhase2 } from './phase2_vectorizer';
import { runPhase3 } from './phase3_rag_extractor';

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });

export { runPhase1, runPhase2, runPhase3 };

export interface ProcessEarningsOptions {
  skipPhase3?: boolean;
}

export async function processEarningsReports(
  onProgress?: (msg: string) => void,
  targetTickers?: string[],
  options: ProcessEarningsOptions = { skipPhase3: true }
) {
  console.log("--- Starting Earnings Processing Pipeline (Phase 1 / 2 / 3) ---");

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

  // Phase 1: PDF取得 & Docling Markdown化
  const { phase1Count, newItems } = await runPhase1(rowsToProcess, total, onProgress);
  
  // Phase 2: 新規MarkdownのQdrantベクトル登録 (BGE-M3 1024次元)
  let phase2Count = 0;
  if (newItems.length > 0) {
    phase2Count = await runPhase2(newItems, onProgress);
  } else {
    console.log(`\n=== Phase 2: No new Markdowns to vectorize. Skipping. ===`);
  }

  // Phase 3: LLM要約・GICS再分類 (デフォルトスキップ)
  let phase3Count = 0;
  if (options.skipPhase3 === false) {
    phase3Count = await runPhase3(rowsToProcess, total, onProgress);
  } else {
    console.log(`\n=== Phase 3: AI Parsing and GICS Reclassification is SKIPPED ===`);
    if (onProgress) onProgress(`[フェーズ3] AI要約・GICS再分類はスキップ設定のため通過しました。`);
  }

  console.log(`\n--- Earnings Processing Complete (Phase1: ${phase1Count}, Phase2: ${phase2Count}, Phase3: ${phase3Count}, Skipped Phase3: ${options.skipPhase3 !== false}) ---`);
}
