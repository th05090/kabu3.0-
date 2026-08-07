import { createClient } from '@libsql/client';
import { reclassifyGics } from '../lib/gics';
import { config } from 'dotenv';
config({ path: '.env.local' });

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });

const AFFECTED_INDUSTRIES = [
  '情報通信・サービスその他',
  '不動産',
  'その他',
  '情報･通信業',
  '証券･商品先物取引業',
  'ガラス･土石製品',
  '電気･ガス業',
  '石油･石炭製品',
  '倉庫･運輸関連業'
];

async function main() {
  const placeholders = AFFECTED_INDUSTRIES.map(() => '?').join(',');
  const query = `
    SELECT ticker, name, industry, gics_audit_status 
    FROM equities_master 
    WHERE (industry IN (${placeholders}) OR gics_audit_status = 'ERROR')
    AND summary IS NOT NULL
  `;
  
  const res = await db.execute({ sql: query, args: AFFECTED_INDUSTRIES });
  const tickers = res.rows;
  
  console.log(`Found ${tickers.length} tickers to reclassify (Affected Industries + ERRORs).`);
  
  for (let i = 0; i < tickers.length; i++) {
    const t = tickers[i];
    console.log(`[${i+1}/${tickers.length}] Reclassifying ${t.name} (${t.ticker}) [${t.industry}] [Audit: ${t.gics_audit_status}]...`);
    await reclassifyGics(String(t.ticker));
  }
  
  console.log('Finished reclassifying affected targets.');
}

main().catch(console.error);
