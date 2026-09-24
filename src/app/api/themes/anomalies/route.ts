import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function GET() {
  try {
    const res = await db.execute(`
      SELECT s.ticker, s.name, s.industry, m.theme, m.gics_audit_reason, m.summary, m.theme_keywords, m.gics_sub_industry_id
      FROM stocks s
      JOIN equities_master m ON s.ticker = m.ticker
      WHERE m.theme IS NOT NULL 
        AND m.gics_audit_status = 'ERROR'
        AND m.gics_sub_industry_id NOT LIKE '98%'
        AND m.gics_sub_industry_id NOT LIKE '99%'
        AND (m.theme IS NULL OR m.theme NOT IN ('株式以外', 'TPM'))
      ORDER BY s.ticker ASC
    `);

    const dataPath = path.join(process.cwd(), 'src', 'data', 'gics_categories.json');
    const rawData = await fs.readFile(dataPath, 'utf8');
    const categories = JSON.parse(rawData);
    const gicsMap = new Map(categories.map((c: any) => [c.sub_industry_id, c.category_name]));

    const anomalies = [];
    
    for (const row of res.rows) {
      const tickerStr = String(row.ticker);
      if (tickerStr.startsWith('6010')) continue;

      let rawReason = String(row.gics_audit_reason);
      let extractedReason = rawReason;
      
      const reasonMatch = rawReason.match(/理由[：:]\s*([\s\S]*)/);
      if (reasonMatch && reasonMatch[1]) {
        extractedReason = reasonMatch[1].trim();
      } else {
        // Fallback if "理由：" isn't found
        extractedReason = rawReason.replace(/\[ERROR\]/i, '').trim();
      }

      anomalies.push({
        ...row,
        theme: gicsMap.get(String(row.gics_sub_industry_id)) || row.theme, // Override theme with Sub-Industry Name
        reasons: [extractedReason]
      });
    }

    return NextResponse.json(anomalies);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
