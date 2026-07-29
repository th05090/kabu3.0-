import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GICS_DICTIONARY } from '../data/gics_dictionary';
import { TSE_TO_GICS_MAPPING } from '../lib/anomaly_detector';
import * as fs from 'fs';

const db = createClient({ url: 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });

const RRF_K = 60;

function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

function escapeFTS5(text: string): string {
  if (!text) return "";
  const terms = text.split(/[,、\s]+/).map(t => t.trim()).filter(t => t);
  return terms.map(t => `"${t.replace(/"/g, '')}"`).join(" OR ");
}

async function printPrompt(ticker: string) {
  const res = await db.execute(`SELECT * FROM equities_master WHERE ticker = '${ticker}'`);
  const t = res.rows[0];
  if (!t) return;
  
  const companyName = String(t.name);
  const industry = String(t.industry);
  const summary = String(t.summary);
  const keywords = String(t.theme_keywords || "");
  const mainSegmentJson = t.main_segment ? String(t.main_segment) : "情報なし";

  const allowedSectors = TSE_TO_GICS_MAPPING[industry] || [];

  const rawData = await fs.promises.readFile('./src/data/gics_categories.json', 'utf8');
  const categories = JSON.parse(rawData);

  const allGicsInfo = categories.map((cat: any) => ({
    id: cat.sub_industry_id,
    name: cat.category_name,
    sector: GICS_DICTIONARY[cat.sub_industry_id]?.sector_name || "Unknown",
    description: cat.description
  }));

  const companyId = generateUuidForTicker(ticker);
  
  const points = await qdrant.retrieve("company_profiles", { ids: [companyId], with_vector: true });
  let denseResults: any[] = [];
  if (points.length > 0 && points[0].vector) {
    denseResults = await qdrant.search("gics_categories", {
      vector: points[0].vector as number[],
      limit: 158,
      with_payload: true
    });
  }

  let sparseResults: any[] = [];
  if (keywords) {
    const ftsQuery = escapeFTS5(keywords);
    if (ftsQuery) {
      const sparseRows = await db.execute({
        sql: 'SELECT sub_industry_id, bm25(gics_fts) as score FROM gics_fts WHERE gics_fts MATCH ? ORDER BY score ASC LIMIT 158',
        args: [ftsQuery]
      });
      sparseResults = sparseRows.rows;
    }
  }

  const rrfScores = new Map<string, number>();
  for (const info of allGicsInfo) rrfScores.set(info.id, 0);

  let dRank = 1;
  for (const res of denseResults) {
    const cid = res.payload?.sub_industry_id as string;
    if (cid) {
      rrfScores.set(cid, (rrfScores.get(cid) || 0) + 1.0 / (RRF_K + dRank));
      dRank++;
    }
  }

  let sRank = 1;
  for (const res of sparseResults) {
    const cid = String(res.sub_industry_id);
    rrfScores.set(cid, (rrfScores.get(cid) || 0) + 1.0 / (RRF_K + sRank));
    sRank++;
  }

  const sortedCandidates = allGicsInfo
    .map(info => ({
      id: info.id,
      name: info.name,
      sector: info.sector,
      description: info.description,
      rrf: rrfScores.get(info.id) || 0
    }))
    .filter(c => allowedSectors.length === 0 || allowedSectors.includes(c.sector))
    .sort((a, b) => b.rrf - a.rrf);

  const top5 = sortedCandidates.slice(0, 5);
  
  let themeListText = "";
  for (const c of top5) {
    themeListText += `"${c.name}", "description": "${c.description}"\n`;
  }

  console.log(`\n=== PROMPT FOR ${ticker} ${companyName} ===`);
  console.log(`「${companyName}」について以下から正しいテーマを選び、選ばれたテーマ名のみ回答してください\n\n企業名：${ticker} ${companyName}\n事業要約：${summary}\n機能的価値 キーワード：\n${keywords}\nメイン事業セクション\n${mainSegmentJson}\n\nテーマリスト\n${themeListText}`);
}

async function run() {
  await printPrompt('65010');
  await printPrompt('67580');
  await printPrompt('80580');
}
run();
