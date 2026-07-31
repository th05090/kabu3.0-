import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GICS_DICTIONARY } from '../data/gics_dictionary';
import { TSE_TO_GICS_MAPPING } from './anomaly_detector';

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
  const terms = text.split(/[,、\s]+/).map(t => t.trim()).filter(t => t);
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

/**
 * Recalculate GICS Sub-Industry classification for a given ticker.
 * This runs the complete Dense + Sparse + RRF + 2-stage LLM pipeline.
 */
export async function reclassifyGics(ticker: string): Promise<{ success: boolean; gics_sub_industry_id?: string; theme?: string; error?: string }> {
  try {
    const targetResult = await db.execute({
      sql: `SELECT ticker, name, industry, summary, theme_keywords, main_segment, sub_segments 
            FROM equities_master WHERE ticker = ?`,
      args: [ticker]
    });
    
    if (targetResult.rows.length === 0) {
      return { success: false, error: `Ticker ${ticker} not found in equities_master.` };
    }
    
    const t = targetResult.rows[0];
    const companyName = String(t.name);
    const industry = String(t.industry);
    const summary = String(t.summary);
    const keywords = String(t.theme_keywords || "");
    const mainSegmentJson = t.main_segment ? String(t.main_segment) : "情報なし";
    const subSegmentsJson = t.sub_segments ? String(t.sub_segments) : "[]";

    console.log(`[GICS] Reclassifying ${companyName} (${ticker})`);

    const dataPath = path.join(process.cwd(), 'src', 'data', 'gics_categories.json');
    const rawData = await fs.readFile(dataPath, 'utf8');
    const categories = JSON.parse(rawData);

    const allGicsInfo = categories.map((cat: any) => ({
      id: cat.sub_industry_id,
      name: cat.category_name,
      sector: GICS_DICTIONARY[cat.sub_industry_id]?.sector_name || "Unknown",
      description: cat.description
    }));

    const allowedSectors = TSE_TO_GICS_MAPPING[industry] || [];
    
    const companyId = generateUuidForTicker(ticker);
    
    // 1. Dense Search
    let denseResults: any[] = [];
    try {
      const points = await qdrant.retrieve("company_profiles", { ids: [companyId], with_vector: true });
      if (points.length > 0 && points[0].vector) {
        const searchRes = await qdrant.search("gics_categories", {
          vector: points[0].vector as number[],
          limit: 158,
          with_payload: true
        });
        denseResults = searchRes;
      }
    } catch(e) {
      console.error(`[GICS] Dense search failed for ${ticker}`, e);
    }

    // 2. Sparse Search (FTS5)
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
        try {
          const sparseRows = await db.execute({
            sql: 'SELECT sub_industry_id, bm25(gics_fts) as score FROM gics_fts WHERE gics_fts MATCH ? ORDER BY score ASC LIMIT 158',
            args: [ftsQuery]
          });
          sparseResults = sparseRows.rows;
        } catch(e) {}
      }
    }

    // 3. RRF
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
      throw new Error(`No valid GICS candidates after filter for ${ticker}.`);
    }

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
        console.error(`  => [Warning] Stage 1 failed. Fallback to top 3.`);
        top3Names = top10.slice(0, 3).map((c: any) => c.name);
      }
      
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
        } else {
          finalGicsId = stage2Candidates[0].id;
          finalGicsSector = stage2Candidates[0].sector;
        }
      } catch(llmErr) {
        finalGicsId = stage2Candidates[0].id;
        finalGicsSector = stage2Candidates[0].sector;
      }
    }

    // Save to DB
    await db.execute({
      sql: "UPDATE equities_master SET theme = ?, gics_sub_industry_id = ? WHERE ticker = ?",
      args: [finalGicsSector, finalGicsId, ticker]
    });
    
    console.log(`[GICS] Successfully updated ${ticker} to ${finalGicsId} (${finalGicsSector})`);

    return { success: true, gics_sub_industry_id: finalGicsId, theme: finalGicsSector };
  } catch (e: any) {
    console.error(`[GICS] Error reclassifying ${ticker}:`, e);
    return { success: false, error: e.message };
  }
}
