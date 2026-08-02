import { createClient } from "@libsql/client";
import * as fs from "fs/promises";
import * as path from "path";

const DB_URL = "file:local.db";
const OLLAMA_URL = "http://localhost:11434/api/generate";

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
  const db = createClient({ url: DB_URL });

  const dataPath = path.join(process.cwd(), 'src', 'data', 'gics_categories.json');
  const rawData = await fs.readFile(dataPath, 'utf8');
  const categories = JSON.parse(rawData);
  const catMap = new Map<string, any>();
  for (const c of categories) {
    catMap.set(c.sub_industry_id, c);
  }

  // Get tickers that have a gics sub industry id but haven't been audited yet
  // Exclude funds since they were already cleared
  const targetsResult = await db.execute(`
    SELECT ticker, name, summary, main_segment, sub_segments, gics_sub_industry_id 
    FROM equities_master 
    WHERE gics_sub_industry_id IS NOT NULL 
      AND gics_audit_status IS NULL
  `);

  const targets = targetsResult.rows;
  console.log(`Found ${targets.length} companies to audit.`);

  let count = 0;
  for (const t of targets) {
    count++;
    const ticker = String(t.ticker);
    const companyName = String(t.name);
    const summary = t.summary ? String(t.summary) : "情報なし";
    const mainSegmentJson = t.main_segment ? String(t.main_segment) : "情報なし";
    const subSegmentsJson = t.sub_segments ? String(t.sub_segments) : "情報なし";
    const gicsId = String(t.gics_sub_industry_id);

    const gicsInfo = catMap.get(gicsId);
    const gicsName = gicsInfo?.category_name || "不明";
    const gicsDesc = gicsInfo?.description || "説明なし";

    console.log(`[${count}/${targets.length}] Auditing ${companyName} (${ticker}) - ${gicsName}`);

    const prompt = `あなたは厳格なGICS分類の監査役です。
企業の実態とGICS分類の間に矛盾がないか監査してください。

企業情報:
${companyName}

事業要約: 
${summary}
メイン事業：${mainSegmentJson}
サブ事業：${subSegmentsJson}

判定されたGICS細分類: 
${gicsName}
判定されたGICS細分類の説明：
${gicsDesc}

判定を出す前に、必ず以下の【ステップ1】を埋めてから、【ステップ2】を出力してください。

【ステップ1：属性の強制言語化】

提供価値： [物理的なモノ / デジタル・データ / 人的サービス] のどれか

顧客対象： [BtoB（企業向け） / BtoC（一般消費者向け）] のどちらか

ビジネス形態： [開発・製造 / 流通・小売り / インフラ提供] のどれか

【ステップ2：矛盾判定】
ステップ1で書き出した企業の実態と、判定されたGICS細分類の説明を比較し、明確な矛盾（ねじれ）があれば [ERROR] と理由を、妥当であれば [OK] を出力してください。`;

    let auditStatus = 'OK';
    let auditReason = '';
    try {
      const llmAnswer = await askRerankLLM(prompt);
      if (llmAnswer.includes('[ERROR]')) {
        auditStatus = 'ERROR';
      } else {
        auditStatus = 'OK';
      }
      auditReason = llmAnswer;
    } catch(e) {
      console.error(`  => Audit failed for ${ticker}`, e);
      // Leave as NULL to retry later, or mark OK?
      // Let's just skip it so it remains NULL and can be retried
      continue;
    }

    await db.execute({
      sql: "UPDATE equities_master SET gics_audit_status = ?, gics_audit_reason = ? WHERE ticker = ?",
      args: [auditStatus, auditReason, ticker]
    });
    console.log(`  => Status: ${auditStatus}`);
  }

  console.log("Audit batch complete.");
}

main().catch(console.error);
