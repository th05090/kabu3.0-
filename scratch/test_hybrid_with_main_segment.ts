import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs';

const RRF_K = 60;
const db = createClient({ url: 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });

const TSE_TO_GICS_MAPPING: Record<string, string[]> = {
  "水産・農林業": ["生活必需品"],
  "食料品": ["生活必需品"],
  "鉱業": ["エネルギー", "素材"],
  "石油・石炭製品": ["エネルギー"],
  "建設業": ["資本財・サービス", "不動産"],
  "金属製品": ["資本財・サービス", "素材"],
  "ガラス・土石製品": ["素材", "資本財・サービス"],
  "化学": ["素材", "ヘルスケア", "生活必需品"],
  "医薬品": ["ヘルスケア"],
  "鉄鋼": ["素材"],
  "非鉄金属": ["素材"],
  "機械": ["資本財・サービス", "情報通信"],
  "電気機器": ["情報通信", "資本財・サービス", "一般消費財・サービス", "ヘルスケア"],
  "輸送用機器": ["一般消費財・サービス", "資本財・サービス"],
  "精密機器": ["ヘルスケア", "情報通信", "資本財・サービス"],
  "その他製品": ["一般消費財・サービス", "資本財・サービス", "素材"],
  "情報・通信業": ["情報通信", "コミュニケーション・サービス"],
  "サービス業": ["資本財・サービス", "一般消費財・サービス", "コミュニケーション・サービス", "情報通信", "ヘルスケア"],
  "電気・ガス業": ["公益事業"],
  "陸運業": ["資本財・サービス"],
  "海運業": ["資本財・サービス"],
  "空運業": ["資本財・サービス"],
  "倉庫・運輸関連業": ["資本財・サービス", "不動産"],
  "卸売業": ["資本財・サービス", "一般消費財・サービス", "生活必需品", "ヘルスケア", "素材", "情報通信"],
  "小売業": ["一般消費財・サービス", "生活必需品"],
  "銀行業": ["金融"],
  "証券、商品先物取引業": ["金融"],
  "保険業": ["金融"],
  "その他金融業": ["金融"],
  "不動産業": ["不動産"],
};

function escapeFTS5(text: string): string {
  if (!text) return "";
  const terms = text.split(/[,、\s]+/).map(t => t.trim()).filter(t => t);
  return terms.map(t => `"${t.replace(/"/g, '')}"`).join(" OR ");
}

async function askLLM(prompt: string): Promise<string> {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma3:12b",
      prompt,
      stream: false,
      temperature: 0.0
    })
  });
  const data = await res.json();
  return data.response.trim();
}

async function testCompany(ticker: string) {
  const res = await db.execute(`SELECT * FROM equities_master WHERE ticker = '${ticker}'`);
  const t = res.rows[0];
  if (!t) {
    console.log(`Ticker ${ticker} not found.`);
    return;
  }
  
  const companyName = String(t.name);
  const industry = String(t.industry);
  const summary = String(t.summary);
  const keywords = String(t.theme_keywords || "");
  let mainSegmentJson = t.main_segment ? String(t.main_segment) : "{}";
  let mainSegmentText = "";
  let segmentName = "";
  
  try {
    const ms = JSON.parse(mainSegmentJson);
    segmentName = ms.segment || "";
    mainSegmentText = `セグメント名: ${ms.segment || ""}\n説明: ${ms.description || ""}`;
  } catch (e) {}

  console.log(`\n========================================`);
  console.log(`Testing ${ticker} ${companyName}`);

  const qdrantText = `【事業要約】\n${summary}\n\n【機能的価値キーワード】\n${keywords}\n\n【メイン事業】\n${mainSegmentText}`;
  
  console.log(`[Dense Vector Generation Text]`);
  console.log(qdrantText);

  const embedRes = await fetch("http://localhost:11434/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "bge-m3", prompt: qdrantText })
  }).then(r => r.json());

  const denseResults = await qdrant.search("gics_categories", {
    vector: embedRes.embedding,
    limit: 158,
    with_payload: true
  });

  const augmentedKeywords = keywords + (segmentName ? `, ${segmentName}` : "");
  console.log(`\n[FTS Query String]`);
  console.log(augmentedKeywords);
  const ftsQuery = escapeFTS5(augmentedKeywords);
  
  let sparseResults: any[] = [];
  if (ftsQuery) {
    const sparseRows = await db.execute({
      sql: 'SELECT sub_industry_id, bm25(gics_fts) as score FROM gics_fts WHERE gics_fts MATCH ? ORDER BY score ASC LIMIT 158',
      args: [ftsQuery]
    });
    sparseResults = sparseRows.rows;
  }

  const rawData = await fs.promises.readFile('./src/data/gics_categories.json', 'utf8');
  const categories = JSON.parse(rawData);

  const rawDict = await fs.promises.readFile('./src/data/gics_dictionary.ts', 'utf8');
  // quick hack to get sector names since we can't easily import it here due to tsx issues
  const sectorMap: Record<string, string> = {};
  for (const cat of categories) {
      sectorMap[cat.sub_industry_id] = "Unknown";
      const match = rawDict.match(new RegExp(`"${cat.sub_industry_id}":\\s*{[^}]*"sector_name":\\s*"([^"]+)"`));
      if (match) {
          sectorMap[cat.sub_industry_id] = match[1];
      }
  }

  const allGicsInfo = categories.map((cat: any) => ({
    id: cat.sub_industry_id,
    name: cat.category_name,
    sector: sectorMap[cat.sub_industry_id],
    description: cat.description
  }));

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

  const allowedSectors = TSE_TO_GICS_MAPPING[industry] || [];
  const sortedCandidates = allGicsInfo
    .map(info => ({ ...info, rrf: rrfScores.get(info.id) || 0 }))
    .filter(c => allowedSectors.length === 0 || allowedSectors.includes(c.sector))
    .sort((a, b) => b.rrf - a.rrf);

  const top5 = sortedCandidates.slice(0, 5);
  console.log(`\n[Top 5 Candidates after RRF]`);
  top5.forEach((c, i) => console.log(`${i+1}. ${c.name} (${c.sector}) [RRF: ${c.rrf.toFixed(4)}]`));
  
  let themeListText = "";
  for (const c of top5) {
    themeListText += `"${c.name}", "description": "${c.description}"\n`;
  }

  const prompt = `「${companyName}」について以下から正しいテーマを選び、選ばれたテーマ名のみ回答してください\n\n企業名：${ticker} ${companyName}\n事業要約：${summary}\n機能的価値 キーワード：\n${keywords}\nメイン事業セクション\n${mainSegmentJson}\n\nテーマリスト\n${themeListText}`;
  
  console.log(`\n[LLM Request...]`);
  const llmOutput = await askLLM(prompt);
  console.log(`LLM Answer: ${llmOutput}`);

  let matchedCandidate = llmOutput;
  const exactMatch = top5.find(c => c.name === llmOutput || llmOutput.includes(c.name));
  if (exactMatch) {
    console.log(`=> Successfully matched LLM output to: ${exactMatch.name}`);
  } else {
    console.log(`=> [Warning] LLM output did not match any candidate. Falling back to Top 1: ${top5[0].name}`);
  }
}

async function run() {
  await testCompany('67580'); // Sony
  await testCompany('65010'); // Hitachi
  await testCompany('80580'); // Mitsubishi
  await testCompany('13010'); // Kyokuyo
}

run();
