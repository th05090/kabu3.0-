import { createClient } from '@libsql/client';
import { reclassifyGics } from '../lib/gics';
import * as fs from 'fs/promises';
import * as path from 'path';

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });

async function main() {
  console.log("--- Starting Hybrid GICS Classification Batch (Audit Mode) ---");

  // Parse optional start index from arguments
  const args = process.argv.slice(2);
  let startIndex = 0;
  if (args.length > 0) {
    const parsed = parseInt(args[0], 10);
    if (!isNaN(parsed) && parsed > 0) {
      startIndex = parsed - 1; // Convert 1-indexed to 0-indexed
    }
  }

  // Load GICS categories to map IDs to names
  const dataPath = path.join(process.cwd(), 'src', 'data', 'gics_categories.json');
  const rawData = await fs.readFile(dataPath, 'utf8');
  const categories = JSON.parse(rawData);
  const gicsMap = new Map();
  for (const cat of categories) {
    gicsMap.set(cat.sub_industry_id, cat.category_name);
  }

  // Fetch targets
  const targetsResult = await db.execute(`
    SELECT ticker, name, industry, summary, theme_keywords, main_segment, sub_segments, gics_sub_industry_id
    FROM equities_master 
    WHERE summary IS NOT NULL 
      AND gics_sub_industry_id IS NOT NULL
      AND name NOT LIKE '%上場信託%'
      AND name NOT LIKE '%ETF%'
      AND name NOT LIKE '%ETN%'
      AND name NOT LIKE '%ＥＴＮ%'
      AND name NOT LIKE '%投資法人%'
      AND name NOT LIKE '%リート%'
      AND name NOT LIKE '%上場投信%'
      AND name NOT LIKE '%ファンド%'
      AND name NOT LIKE '%ＥＴＦ%'
  `);
  const targets = targetsResult.rows;
  console.log(`Found ${targets.length} companies to classify.`);
  if (startIndex > 0) {
    console.log(`Resuming from company #${startIndex + 1}...`);
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = startIndex; i < targets.length; i++) {
    const t = targets[i];
    const ticker = String(t.ticker);
    const companyName = String(t.name);
    const oldGicsId = String(t.gics_sub_industry_id);
    const oldGicsName = gicsMap.get(oldGicsId) || oldGicsId;

    console.log(`\n[${i+1}/${targets.length}] Processing ${companyName} (${ticker})`);

    try {
      // reclassifyGics handles vector search, FTS, LLM rerank, and writing the audit status.
      // It already prints the final [Audit: OK/ERROR] to the terminal.
      const gicsResult = await reclassifyGics(ticker);
      if (gicsResult.success) {
        const newGicsId = String(gicsResult.gics_sub_industry_id);
        const newGicsName = gicsMap.get(newGicsId) || newGicsId;
        console.log(`  => 【変更結果】: ${oldGicsName}  --->  ${newGicsName}`);
        successCount++;
      } else {
        failCount++;
      }
    } catch (e: any) {
      console.error(`  [Error] Failed processing ticker ${ticker}:`, e.message || e);
      failCount++;
    }
  }

  console.log(`\n--- Classification Complete ---`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

main().catch(console.error);
