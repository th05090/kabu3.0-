import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs';
import { askLLM, pass1PromptTemplate, pass2PromptTemplate } from '../src/scripts/rag/theme_prompts.js';

const RRF_K = 60;
const db = createClient({ url: 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });

const TSE_TO_GICS_MAPPING: Record<string, string[]> = {
  "水産・農林業": ["生活必需品"],
  "食料品": ["生活必需品"],
  "鉱業": ["エネルギー", "素材"],
  "卸売業": ["資本財・サービス", "一般消費財・サービス", "生活必需品", "ヘルスケア", "素材", "情報通信"],
};

function escapeFTS5(text: string): string {
  if (!text) return "";
  const terms = text.split(/[,、\s]+/).map(t => t.trim()).filter(t => t);
  return terms.map(t => `"${t.replace(/"/g, '')}"`).join(" OR ");
}

async function extractAllSegments(ticker5: string) {
  const embResTable = await fetch("http://localhost:11434/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "bge-m3", prompt: "報告セグメント 売上高 利益 金額 表" })
  }).then(r => r.json());

  const searchResTable = await qdrant.search("earnings_reports", {
    vector: embResTable.embedding,
    limit: 2,
    filter: { must: [{ key: "ticker", match: { value: ticker5 } }] },
    with_payload: true
  });

  const pass1Text = searchResTable.map(hit => hit.payload?.text || "").join("\n");
  let llmText1 = await askLLM(pass1PromptTemplate(pass1Text), true);
  llmText1 = llmText1.replace(/^```(json)?/, "").replace(/```$/, "").trim();
  
  let segmentsData = [];
  try {
    segmentsData = JSON.parse(llmText1);
    if (!Array.isArray(segmentsData)) segmentsData = [segmentsData];
  } catch (e) {
    return [];
  }

  const segmentNames = segmentsData.map(s => s.segment).filter(n => n && n.trim() !== "");
  if (segmentNames.length === 0) return [];

  const embResText = await fetch("http://localhost:11434/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "bge-m3", prompt: "報告セグメント 概要 事業内容 製品 サービス" })
  }).then(r => r.json());

  const searchResText = await qdrant.search("earnings_reports", {
    vector: embResText.embedding,
    limit: 3,
    filter: { must: [{ key: "ticker", match: { value: ticker5 } }] },
    with_payload: true
  });

  const pass2Text = searchResText.map(hit => hit.payload?.text || "").join("\n");
  let llmText2 = await askLLM(pass2PromptTemplate(segmentNames, pass2Text), true);
  llmText2 = llmText2.replace(/^```(json)?/, "").replace(/```$/, "").trim();
  
  let descriptionsData = [];
  try {
    descriptionsData = JSON.parse(llmText2);
    if (!Array.isArray(descriptionsData)) descriptionsData = [descriptionsData];
  } catch (e) {}

  const mergedSegments = segmentsData.map(s1 => {
    const descObj = descriptionsData.find(s2 => s2.segment === s1.segment);
    return {
      segment: s1.segment,
      revenue: s1.revenue,
      description: descObj ? descObj.description : "記載なし"
    };
  });

  // Sort by revenue descending
  mergedSegments.sort((a, b) => {
    const revA = parseInt(String(a.revenue).replace(/[^0-9]/g, "")) || 0;
    const revB = parseInt(String(b.revenue).replace(/[^0-9]/g, "")) || 0;
    return revB - revA;
  });

  return mergedSegments;
}

async function testCompanyWithSubSegments(ticker: string) {
  const res = await db.execute(`SELECT * FROM equities_master WHERE ticker = '${ticker}'`);
  const t = res.rows[0];
  if (!t) return;
  
  const companyName = String(t.name);
  const industry = String(t.industry);
  const summary = String(t.summary);
  const keywords = String(t.theme_keywords || "");

  console.log(`\n========================================`);
  console.log(`Extracting segments for ${ticker} ${companyName}...`);
  const allSegments = await extractAllSegments(ticker);
  
  const mainSegment = allSegments[0] || {};
  const subSegments = allSegments.slice(1, 3); // Get up to 2 sub segments

  const mainSegmentText = mainSegment.segment ? `セグメント名: ${mainSegment.segment}\n説明: ${mainSegment.description}` : "";
  const subSegmentText = subSegments.map(s => `セグメント名: ${s.segment}\n説明: ${s.description}`).join("\n---\n");

  const qdrantText = `【事業要約】\n${summary}\n\n【機能的価値キーワード】\n${keywords}\n\n【メイン事業】\n${mainSegmentText}\n\n【サブ事業】\n${subSegmentText}`;
  
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

  const subSegmentNames = subSegments.map(s => s.segment).join(", ");
  const augmentedKeywords = keywords + (mainSegment.segment ? `, ${mainSegment.segment}` : "") + (subSegmentNames ? `, ${subSegmentNames}` : "");
  
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
  const sectorMap: Record<string, string> = {};
  for (const cat of categories) {
      sectorMap[cat.sub_industry_id] = "Unknown";
      const match = rawDict.match(new RegExp(`"${cat.sub_industry_id}":\\s*{[^}]*"sector_name":\\s*"([^"]+)"`));
      if (match) { sectorMap[cat.sub_industry_id] = match[1]; }
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
    if (cid) { rrfScores.set(cid, (rrfScores.get(cid) || 0) + 1.0 / (RRF_K + dRank)); dRank++; }
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
  let themeListText = "";
  for (const c of top5) {
    themeListText += `"${c.name}", "description": "${c.description}"\n`;
  }

  const prompt = `「${companyName}」について以下から正しいテーマを選び、選ばれたテーマ名のみ回答してください

企業名：${ticker} ${companyName}
事業要約：${summary}
機能的価値 キーワード：
${keywords}

【メイン事業セクション】
${JSON.stringify(mainSegment)}

【サブ事業セクション】
${JSON.stringify(subSegments)}

テーマリスト
${themeListText}`;

  console.log(`\n=== PROMPT FOR ${ticker} ===\n${prompt}`);
  
  console.log(`\n[LLM Request...]`);
  const llmOutput = await askLLM(prompt, false);
  console.log(`LLM Answer: ${llmOutput}`);
}

async function run() {
  await testCompanyWithSubSegments('80580'); // Mitsubishi
  await testCompanyWithSubSegments('13010'); // Kyokuyo
}

run();
