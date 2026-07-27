import fs from "fs/promises";
import { createClient } from "@libsql/client";

const DB_URL = "file:local.db";
const OLLAMA_URL = "http://localhost:11434/api/generate";
const DATA_PATH = "scratch/shikiho_company_profiles.json";

async function main() {
  const db = createClient({ url: DB_URL });

  // 1. Initialize DB Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS shikiho_profiles (
      ticker TEXT PRIMARY KEY,
      original_feature TEXT,
      index_summary TEXT,
      index_keywords TEXT
    )
  `);
  console.log("Checked/Created table: shikiho_profiles");

  // Load existing records for resume capability
  const existingRows = await db.execute("SELECT ticker FROM shikiho_profiles");
  const processedTickers = new Set(existingRows.rows.map((r: any) => r.ticker));
  console.log(`Found ${processedTickers.size} already processed records in DB.`);

  // 2. Read JSON Data
  const rawData = await fs.readFile(DATA_PATH, "utf-8");
  const profiles = JSON.parse(rawData);
  console.log(`Loaded ${profiles.length} total profiles from JSON.`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // 3. Process loop
  for (let i = 0; i < profiles.length; i++) {
    const t = profiles[i];
    
    // Skip empty features
    if (!t.feature_text || t.feature_text === "-") {
      skipCount++;
      continue;
    }

    // Skip already processed (Resume)
    if (processedTickers.has(t.code)) {
      skipCount++;
      continue;
    }

    console.log(`\n[${i + 1}/${profiles.length}] Processing ${t.name} (${t.code})...`);

    const prompt = `あなたはデータ構造化エンジニアです。以下の情報を元に、ベクトル検索用の無機質なインデックステキストを生成してください。
【厳守事項】
・取引先企業名（任天堂、Appleなど）、サービス固有のブランド名、地名はすべて完全に削除すること。
・「何を（モノ・データ）」「どうしている（コト・機能）」という事業の機能的価値のみを抽出すること。
※ただし、事業特色の記載がある場合は一緒に抽出すること
・投資家向けの装飾的な言葉（「大手」「強みを持つ」）は一切排除すること。
・ 出力は以下のJSON配列のみとし、マークダウンのコードブロックで囲まないでください。

[
  { "概要": "内容", "機能的価値 (キーワード)": "キーワード1,キーワード2,キーワード3" }
]

【対象情報】
${t.feature_text}`;

    try {
      const res = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma3:12b",
          prompt: prompt,
          stream: false,
          format: "json", // Enforce JSON
          options: { temperature: 0.2 }
        })
      });

      if (!res.ok) {
        throw new Error(`Ollama API error: ${res.status}`);
      }

      const jsonRes = await res.json();
      let llmText = jsonRes.response.trim();
      
      // Clean markdown if the model ignored the instruction
      llmText = llmText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
      
      let parsed;
      try {
        parsed = JSON.parse(llmText);
      } catch (parseErr) {
        console.error(`Failed to parse JSON for ${t.code}. Raw text:\n${llmText}`);
        errorCount++;
        continue;
      }
      
      const data = Array.isArray(parsed) ? parsed[0] : parsed;
      const summary = data["概要"] || "";
      const keywords = data["機能的価値 (キーワード)"] || "";

      // 4. Save to DB
      await db.execute({
        sql: `INSERT INTO shikiho_profiles (ticker, original_feature, index_summary, index_keywords)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(ticker) DO UPDATE SET
                original_feature = excluded.original_feature,
                index_summary = excluded.index_summary,
                index_keywords = excluded.index_keywords`,
        args: [t.code, t.feature_text, summary, keywords]
      });

      console.log(`Saved successfully for ${t.code}`);
      successCount++;

    } catch (e) {
      console.error(`Error processing ${t.code}:`, e);
      errorCount++;
    }
  }

  console.log(`\n=== Batch Finished ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Skipped: ${skipCount}`);
  console.log(`Errors : ${errorCount}`);
}

main().catch(console.error);
