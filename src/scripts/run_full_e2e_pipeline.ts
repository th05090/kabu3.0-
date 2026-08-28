import { processEarningsReports } from '../lib/earnings_processor';
import { fetchAllIRNewsGlobal } from './fetch_ir_news';
import { processIrNews } from './analyze_ir_news';
import { createClient } from '@libsql/client';

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });

async function main() {
  const targetTicker = process.argv[2];
  
  if (targetTicker) {
    console.log(`\n========== Starting E2E Pipeline for ${targetTicker} ==========`);
  } else {
    console.log(`\n========== Starting E2E Pipeline for ALL TICKERS ==========`);
    console.log(`[WARNING] This will take a VERY long time and consume heavy CPU/GPU resources.`);
  }

  // 1. Fetch Earnings PDF, Convert to MD (Docling), Extract Segments (Gemma3), Update DB & Qdrant
  console.log(`\n>>> [1/4] Running Earnings Pipeline (Fetch -> MD -> GICS -> Qdrant)`);
  await processEarningsReports((msg) => console.log(msg), targetTicker ? [targetTicker] : undefined);

  let tickersToAnalyze = [];
  if (targetTicker) {
    tickersToAnalyze = [targetTicker];
  } else {
    const res = await db.execute(`SELECT DISTINCT ticker FROM financials`);
    tickersToAnalyze = res.rows.map(r => String(r.ticker));
  }

  // 3. Fetch IR News
  console.log(`\n>>> [3/4] Fetching IR News (New Business) from IR BANK`);
  await fetchAllIRNewsGlobal(5);

  // 4. Analyze IR News & Append to Qdrant
  console.log(`\n>>> [4/4] Analyzing IR News (Docling -> Gemma3 -> Qdrant Update)`);
  await processIrNews((msg) => console.log(msg));

  console.log(`\n========== E2E Pipeline Completed! ==========`);
}

main().catch(console.error);
