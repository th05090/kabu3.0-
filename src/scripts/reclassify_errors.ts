import { createClient } from '@libsql/client';
import { reclassifyGics } from '../lib/gics';
import { config } from 'dotenv';
config({ path: '.env.local' });

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });

async function main() {
  const res = await db.execute("SELECT ticker, name, industry FROM equities_master WHERE gics_audit_status = 'ERROR'");
  const tickers = res.rows;
  
  console.log(`Found ${tickers.length} tickers with ERROR status.`);
  
  for (let i = 0; i < tickers.length; i++) {
    const t = tickers[i];
    console.log(`[${i+1}/${tickers.length}] Reclassifying ${t.name} (${t.ticker}) [${t.industry}]...`);
    await reclassifyGics(String(t.ticker));
  }
  
  console.log('Finished reclassifying errors.');
}

main().catch(console.error);
