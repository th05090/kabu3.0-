import { createClient } from '@libsql/client';
import * as fs from 'fs/promises';
import * as path from 'path';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

async function main() {
  const dataDir = path.join(process.cwd(), 'src', 'data');
  const files = await fs.readdir(dataDir);
  
  const reportFiles = files.filter(f => f.endsWith('_ai_report.json'));
  console.log(`Found ${reportFiles.length} AI report JSON files.`);

  let successCount = 0;
  let failCount = 0;

  for (const file of reportFiles) {
    const ticker = file.replace('_ai_report.json', '');
    const filePath = path.join(dataDir, file);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      await db.execute({
        sql: `INSERT OR REPLACE INTO ai_reports 
              (ticker, current_performance, future_guidance, report_comparison, ai_comment, updated_at) 
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          ticker,
          data['current_performance'] || '',
          data['future_guidance'] || '',
          data['report_comparison'] || '',
          data['ai_comment'] || '',
          new Date().toISOString()
        ]
      });
      successCount++;
    } catch (err) {
      console.error(`Failed to process ${file}:`, err);
      failCount++;
    }
  }

  console.log(`Migration completed. Success: ${successCount}, Failed: ${failCount}`);
}

main().catch(console.error);
