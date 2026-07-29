import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { askLLM, pass1PromptTemplate, pass2PromptTemplate } from './rag/theme_prompts.js';

async function extractMainSegment(db: any, qdrant: any, ticker5: string) {
  console.log(`\n========================================`);
  console.log(`Extracting main segment for ${ticker5}...`);
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
  const p1Template = pass1PromptTemplate(pass1Text);
  console.log(`\n--- PASS 1 PROMPT ---`);
  console.log(p1Template);

  let llmText1 = await askLLM(p1Template, true);
  console.log(`\n--- PASS 1 RESPONSE ---`);
  console.log(llmText1);

  llmText1 = llmText1.replace(/^```(json)?/, "").replace(/```$/, "").trim();
  
  let segmentsData = [];
  try {
    segmentsData = JSON.parse(llmText1);
    if (!Array.isArray(segmentsData)) segmentsData = [segmentsData];
  } catch (e) {
    return null;
  }
  if (segmentsData.length === 0) return null;

  const segmentNames = segmentsData.map(s => s.segment).filter(n => n && n.trim() !== "");
  
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
  const p2Template = pass2PromptTemplate(segmentNames, pass2Text);
  console.log(`\n--- PASS 2 PROMPT ---`);
  console.log(p2Template);

  let llmText2 = await askLLM(p2Template, true);
  console.log(`\n--- PASS 2 RESPONSE ---`);
  console.log(llmText2);
}

async function run() {
  const db = createClient({ url: 'file:local.db' });
  const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });
  
  await extractMainSegment(db, qdrant, '67580'); // Sony
}
run();
