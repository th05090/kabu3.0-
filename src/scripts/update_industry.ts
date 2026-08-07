import { createClient } from '@libsql/client';
import { fetchJQuants, downloadAndProcessCsv } from '../lib/jquants';
import * as fs from 'fs/promises';
import { config } from 'dotenv';

config({ path: '.env.local' });

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });

async function main() {
  console.log("Fetching J-Quants equities/master...");
  
  const masterList = await fetchJQuants('/v2/bulk/list?endpoint=equities/master');
  const masterFiles = masterList.data || [];
  const latestMasterFile = masterFiles[masterFiles.length - 1];
  
  if (latestMasterFile) {
    console.log(`Downloading Master File: ${latestMasterFile.Key}`);
    const getRes = await fetchJQuants(`/v2/bulk/get?key=${latestMasterFile.Key}`);
    
    let updated = 0;
    
    await downloadAndProcessCsv(getRes.url, async (row) => {
      if (!row.Code) return;
      const industry = row.S33Nm || row.S17Nm || '';
      if (!industry) return;
      
      await db.execute({
        sql: `UPDATE equities_master SET industry = ? WHERE ticker = ?`,
        args: [industry, row.Code]
      });
      updated++;
      if (updated % 1000 === 0) {
        console.log(`Updated ${updated} records...`);
      }
    });
    
    console.log(`Finished updating ${updated} records!`);
  } else {
    console.log("No master file found.");
  }
}

main().catch(console.error);
