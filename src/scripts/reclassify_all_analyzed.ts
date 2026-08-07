import { createClient } from '@libsql/client';
import { reclassifyGics } from '../lib/gics';
import { config } from 'dotenv';
config({ path: '.env.local' });

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });

async function main() {
  const query = `
    SELECT ticker, name, industry, gics_audit_status 
    FROM equities_master 
    WHERE summary IS NOT NULL
  `;
  
  const res = await db.execute(query);
  const tickers = res.rows;
  
  console.log(`Found ${tickers.length} tickers to reclassify (All AI-analyzed stocks).`);
  
  for (let i = 0; i < tickers.length; i++) {
    const t = tickers[i];
    console.log(`[${i+1}/${tickers.length}] Reclassifying ${t.name} (${t.ticker}) [${t.industry}] [Audit: ${t.gics_audit_status}]...`);
    await reclassifyGics(String(t.ticker));
  }
  
  console.log('Finished reclassifying all analyzed targets.');
}

main().catch(console.error);
