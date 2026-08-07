import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { reclassifyGics } from '../lib/gics';
import { config } from 'dotenv';
config({ path: '.env.local' });

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });
const q = new QdrantClient({ host: 'localhost', port: 6333 });

async function main() {
  console.log("Fetching AI Reports list...");
  const res = await db.execute('SELECT ticker FROM ai_reports');
  const tickers = res.rows.map(r => String(r.ticker));
  
  console.log(`Found ${tickers.length} tickers to check.`);
  let recovered = 0;
  
  for (const ticker of tickers) {
    const eq = await db.execute({
      sql: 'SELECT gics_sub_industry_id FROM equities_master WHERE ticker = ?',
      args: [ticker]
    });
    
    if (eq.rows.length === 0) continue;
    
    if (eq.rows[0].gics_sub_industry_id) {
      continue; // already classified
    }

    const qRes = await q.scroll('company_profiles', {
      filter: { must: [{ key: 'ticker', match: { value: ticker } }] },
      limit: 1,
      with_payload: true
    });

    if (qRes.points.length > 0) {
      const payload = qRes.points[0].payload as any;
      const summary = payload.summary || '';
      const text = payload.text || '';
      
      let mainSeg: any = null;
      let subSegs: any[] = [];

      const mainMatch = text.match(/【メイン事業】\nセグメント名:\s*([^\n]+)\n説明:\s*([^\n]+)/);
      if (mainMatch) {
        mainSeg = { segment: mainMatch[1], description: mainMatch[2] };
      }

      const subTextMatch = text.match(/【サブ事業】\n([\s\S]+)$/);
      if (subTextMatch) {
        const subBlocks = subTextMatch[1].split('---\n');
        for (const b of subBlocks) {
          const sMatch = b.match(/セグメント名:\s*([^\n]+)\n説明:\s*([^\n]+)/);
          if (sMatch) {
            subSegs.push({ segment: sMatch[1], description: sMatch[2] });
          }
        }
      }

      await db.execute({
        sql: 'UPDATE equities_master SET summary = ?, main_segment = ?, sub_segments = ? WHERE ticker = ?',
        args: [summary, JSON.stringify(mainSeg || {}), JSON.stringify(subSegs), ticker]
      });

      console.log(`[${recovered + 1}] Recovered DB for ${ticker}. Classifying GICS...`);
      await reclassifyGics(ticker);
      recovered++;
    }
  }
  console.log(`Finished! Recovered ${recovered} tickers.`);
}

main().catch(console.error);
