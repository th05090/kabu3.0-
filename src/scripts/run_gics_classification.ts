import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GICS_DICTIONARY } from '../data/gics_dictionary';
import { TSE_TO_GICS_MAPPING } from '../lib/anomaly_detector';

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });
const OLLAMA_URL = "http://localhost:11434/api/generate";

const RRF_K = 60;

function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

// FTS5 Safe String Escaping
function escapeFTS5(text: string): string {
  if (!text) return "";
  // Split by comma or space, remove empty
  const terms = text.split(/[,、\s]+/).map(t => t.trim()).filter(t => t);
  // Remove quotes inside words to prevent injection, wrap each term in double quotes
  return terms.map(t => `"${t.replace(/"/g, '')}"`).join(" OR ");
}

async function askRerankLLM(prompt: string): Promise<string> {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma3:12b",
      prompt: prompt,
      stream: false,
      options: { temperature: 0.1 }
    })
  });
  if (!res.ok) throw new Error(`LLM API Error: ${res.status}`);
  const json = await res.json();
  return json.response.trim();
}

async function main() {
  console.log("--- Starting Hybrid GICS Classification Batch ---");

  // Ensure gics_sub_industry_id exists
  try {
    await db.execute('ALTER TABLE equities_master ADD COLUMN gics_sub_industry_id TEXT');
  } catch (e: any) {}

  // Fetch targets
  const targetsResult = await db.execute(`
    SELECT ticker, name, industry, summary, theme_keywords, main_segment, sub_segments
    FROM equities_master 
    WHERE summary IS NOT NULL 
      AND name NOT LIKE '%ETF%'
      AND name NOT LIKE '%ETN%'
      AND name NOT LIKE '%REIT%'
      AND name NOT LIKE '%投資法人%'
      AND name NOT LIKE '%証券投資%'
      AND name NOT LIKE '%ファンド%'
      AND name NOT LIKE '%ＥＴＦ%'
  `);
  const targets = targetsResult.rows;
  console.log(`Found ${targets.length} companies to classify.`);

  const dataPath = path.join(process.cwd(), 'src', 'data', 'gics_categories.json');
  const rawData = await fs.readFile(dataPath, 'utf8');
  const categories = JSON.parse(rawData);

  // Prepare a lookup dictionary for all GICS to their Main Sector name
  const allGicsInfo = categories.map((cat: any) => ({
    id: cat.sub_industry_id,
    name: cat.category_name,
    sector: GICS_DICTIONARY[cat.sub_industry_id]?.sector_name || "Unknown",
    description: cat.description
  }));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const ticker = String(t.ticker);
    const companyName = String(t.name);
    const industry = String(t.industry);
    const summary = String(t.summary);
    const keywords = String(t.theme_keywords || "");
    const mainSegmentJson = t.main_segment ? String(t.main_segment) : "情報なし";
    const subSegmentsJson = t.sub_segments ? String(t.sub_segments) : "[]";

    console.log(`\n[${i+1}/${targets.length}] Processing ${companyName} (${ticker})`);

    // 1. Get Allowed Sectors from TSE-33
    const allowedSectors = TSE_TO_GICS_MAPPING[industry] || [];
    if (allowedSectors.length === 0) {
      console.log(`  [Warning] No TSE mapping for industry: ${industry}. Allowing all.`);
    }

    try {
      const companyId = generateUuidForTicker(ticker);
      
      // 2. Dense Search
      const points = await qdrant.retrieve("company_profiles", { ids: [companyId], with_vector: true });
      let denseResults: any[] = [];
      if (points.length > 0 && points[0].vector) {
        const searchRes = await qdrant.search("gics_categories", {
          vector: points[0].vector as number[],
          limit: 158, // Retrieve all to rank
          with_payload: true
        });
        denseResults = searchRes;
      }

      // 3. Sparse Search (FTS5)
      let sparseResults: any[] = [];
      let subSegmentNames = "";
      try {
        if (t.sub_segments) {
          const subs = JSON.parse(String(t.sub_segments));
          subSegmentNames = subs.map((s: any) => s.segment).join(", ");
        }
      } catch (e) {}

      let mainSegmentName = "";
      try {
        if (t.main_segment) {
          const m = JSON.parse(String(t.main_segment));
          mainSegmentName = m.segment || "";
        }
      } catch (e) {}

      const augmentedKeywords = keywords + (mainSegmentName ? `, ${mainSegmentName}` : "") + (subSegmentNames ? `, ${subSegmentNames}` : "");

      if (augmentedKeywords) {
        const ftsQuery = escapeFTS5(augmentedKeywords);
        if (ftsQuery) {
          const sparseRows = await db.execute({
            sql: 'SELECT sub_industry_id, bm25(gics_fts) as score FROM gics_fts WHERE gics_fts MATCH ? ORDER BY score ASC LIMIT 158',
            args: [ftsQuery]
          });
          sparseResults = sparseRows.rows;
        }
      }

      // 4. Calculate RRF and apply filter
      const rrfScores = new Map<string, number>();

      // Initialize map with all GICS to allow fallback if searches return nothing
      for (const info of allGicsInfo) rrfScores.set(info.id, 0);

      // Add Dense Rank (1-indexed)
      let dRank = 1;
      for (const res of denseResults) {
        const cid = res.payload?.sub_industry_id as string;
        if (cid) {
          rrfScores.set(cid, (rrfScores.get(cid) || 0) + 1.0 / (RRF_K + dRank));
          dRank++;
        }
      }

      // Add Sparse Rank (1-indexed)
      let sRank = 1;
      for (const res of sparseResults) {
        const cid = String(res.sub_industry_id);
        rrfScores.set(cid, (rrfScores.get(cid) || 0) + 1.0 / (RRF_K + sRank));
        sRank++;
      }

      // Filter by Allowed Sectors and Sort
      const sortedCandidates = allGicsInfo
        .map((info: any) => ({
          id: info.id,
          name: info.name,
          sector: info.sector,
          description: info.description,
          rrf: rrfScores.get(info.id) || 0
        }))
        .filter((c: any) => allowedSectors.length === 0 || allowedSectors.includes(c.sector))
        .sort((a: any, b: any) => b.rrf - a.rrf);

      if (sortedCandidates.length === 0) {
        console.error(`  [Error] No valid GICS candidates after filter for ${ticker}.`);
        failCount++;
        continue;
      }

      // Extract Top 10
      const top10 = sortedCandidates.slice(0, 10);
      
      let finalGicsId = top10[0].id;
      let finalGicsSector = top10[0].sector;
      
      if (top10.length > 1) {
        let themeListText = "";
        for (const c of top10) {
          themeListText += `"${c.name}", "description": "${c.description}"\n`;
        }

        const prompt1 = `「${companyName}」について「事業要約」、「機能的価値 キーワード」、「メイン事業セクション」、「サブ事業セクション」の4つの情報をもとに、関連性が高いテーマをテーマリストから最大3つ選び、文字列のJSON配列として回答してください。例: ["テーマA", "テーマB", "テーマC"]
最優先判定基準: 【メイン事業セクション】の売上規模および事業内容に最も直接合致するテーマを必ず1つ以上含めてください。

企業名：${ticker} ${companyName}
事業要約：${summary}
機能的価値 キーワード：
${keywords}
【メイン事業セクション】
${mainSegmentJson}
【サブ事業セクション】
${subSegmentsJson}
テーマリスト
${themeListText}`;

        let top3Names: string[] = [];
        try {
          const llmAnswer1 = await askRerankLLM(prompt1);
          const match = llmAnswer1.match(/\[[\s\S]*\]/);
          if (match) {
            top3Names = JSON.parse(match[0]);
          } else {
            top3Names = JSON.parse(llmAnswer1);
          }
        } catch(llmErr) {
          console.error(`  => [Warning] Stage 1 failed to parse JSON. Falling back to top 3 by RRF.`);
          top3Names = top10.slice(0, 3).map((c: any) => c.name);
        }
        
        // Match chosen names back to candidates
        let stage2Candidates = top10.filter((c: any) => top3Names.some((n: string) => n.includes(c.name) || c.name.includes(n)));
        if (stage2Candidates.length === 0) {
           stage2Candidates = top10.slice(0, 3);
        }

        let themeListText2 = "";
        for (const c of stage2Candidates) {
          themeListText2 += `"${c.name}", "description": "${c.description}"\n`;
        }
        
        const prompt2 = `以下の3つの候補の中から、「${companyName}」の事業内容に最も一致するテーマを厳密に1つ選び、テーマ名のみ回答してください。\n\n企業名：${ticker} ${companyName}\n事業要約：${summary}\n機能的価値 キーワード：\n${keywords}\n\n【メイン事業セクション】\n${mainSegmentJson}\n\n【サブ事業セクション】\n${subSegmentsJson}\n\nテーマリスト\n${themeListText2}`;

        try {
          const llmAnswer2 = await askRerankLLM(prompt2);
          const matchedCandidate = stage2Candidates.find((c: any) => llmAnswer2.includes(c.name) || c.name.includes(llmAnswer2.trim()));
          if (matchedCandidate) {
            finalGicsId = matchedCandidate.id;
            finalGicsSector = matchedCandidate.sector;
            console.log(`  => Classified: ${matchedCandidate.name}`);
          } else {
            console.log(`  => [Warning] Stage 2 LLM output did not match. Falling back to Top 1: ${stage2Candidates[0].name}`);
            finalGicsId = stage2Candidates[0].id;
            finalGicsSector = stage2Candidates[0].sector;
          }
        } catch(llmErr) {
          console.error(`  => [Error] Stage 2 LLM request failed. Falling back to Top 1.`);
          finalGicsId = stage2Candidates[0].id;
          finalGicsSector = stage2Candidates[0].sector;
        }
      }

      // Save to DB
      await db.execute({
        sql: "UPDATE equities_master SET theme = ?, gics_sub_industry_id = ? WHERE ticker = ?",
        args: [finalGicsSector, finalGicsId, ticker]
      });
      successCount++;
    } catch (e) {
      console.error(`  [Error] Failed processing ticker ${ticker}:`, e);
      failCount++;
    }
  }

  console.log(`\n--- Classification Complete ---`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

main().catch(console.error);
