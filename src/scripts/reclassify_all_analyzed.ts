import { createClient } from '@libsql/client';
import { reclassifyGics } from '../features/gics/classifier';
import { config } from 'dotenv';
config({ path: '.env.local' });

process.env.USE_GEMINI_AUDIT = 'true';
process.env.GEMINI_AUDIT_MODEL = 'gemini-3.5-flash-lite';

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });

async function main() {
  const query = `
    SELECT ticker, name, industry, gics_audit_status 
    FROM equities_master 
    WHERE summary IS NOT NULL
    ORDER BY ticker ASC
  `;
  
  const res = await db.execute(query);
  
  const tickers = res.rows;
  
  console.log(`Found ${tickers.length} tickers to reclassify (All AI-analyzed stocks).`);
  
  const startIndex = tickers.findIndex(t => String(t.ticker) === "78070");
  const start = startIndex !== -1 ? startIndex : 0;
  
  for (let i = start; i < tickers.length; i++) {
    const t = tickers[i];
    console.log(`[${i+1}/${tickers.length}] Reclassifying ${t.name} (${t.ticker}) [${t.industry}] [Audit: ${t.gics_audit_status}]...`);
    const result = await reclassifyGics(String(t.ticker));
    if (result.error && result.error.includes('429')) {
      console.error(`Stopping batch due to 429 Rate Limit error on ${t.ticker}`);
      break;
    }
  }
  
  console.log('Finished reclassifying all analyzed targets.');
}

main().catch(console.error);
