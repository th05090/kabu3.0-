import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { detectAnomalies } from '@/lib/anomaly_detector';

export async function GET() {
  try {
    const res = await db.execute(`
      SELECT s.ticker, s.name, s.industry, m.theme, m.gics_similarity_score, m.summary, m.theme_keywords
      FROM stocks s
      JOIN equities_master m ON s.ticker = m.ticker
      WHERE m.theme IS NOT NULL
    `);

    const anomalies = [];
    
    for (const row of res.rows) {
      // 投資法人・REIT・ETF (6010*) 等は除外
      const tickerStr = String(row.ticker);
      if (tickerStr.startsWith('6010')) continue;

      const detection = detectAnomalies(
        String(row.industry || ''), 
        String(row.theme || ''), 
        Number(row.gics_similarity_score || 0)
      );

      if (detection.isAnomaly) {
        anomalies.push({
          ...row,
          reasons: detection.reasons
        });
      }
    }

    return NextResponse.json(anomalies);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
