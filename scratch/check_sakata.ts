import { createClient } from "@libsql/client";
import { QdrantClient } from "@qdrant/js-client-rest";
import { askLLM, pass1PromptTemplate, pass2PromptTemplate } from "./rag/theme_prompts.js";

async function run() {
  const db = createClient({ url: "file:local.db" });
  const res = await db.execute("SELECT ticker, name FROM equities_master WHERE name LIKE '%サカタのタネ%'");
  if (res.rows.length === 0) {
    console.log("Sakata Seed not found");
    return;
  }
  const ticker5 = String(res.rows[0].ticker);
  console.log(`Found: ${res.rows[0].name} (${ticker5})`);

  const qdrant = new QdrantClient({ url: "http://localhost:6333" });

  console.log("Running pass 1 to get segments...");
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
  } catch (e) {}

  if (segmentsData.length === 0) return;

  const segmentNames = segmentsData.map(s => s.segment).filter(n => n && n.trim() !== "");
  console.log("Running pass 2 to get descriptions...");
  
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

  let maxSegment = mergedSegments[0];
  for (const s of mergedSegments) {
    const revValueS = parseInt(String(s.revenue).replace(/[^0-9]/g, "")) || 0;
    const revValueMax = parseInt(String(maxSegment.revenue).replace(/[^0-9]/g, "")) || 0;
    if (revValueS > revValueMax) maxSegment = s;
  }

  console.log("=== MAIN SEGMENT ===");
  console.log(JSON.stringify(maxSegment, null, 2));
}

run();
