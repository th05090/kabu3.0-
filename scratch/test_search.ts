import { QdrantClient } from "@qdrant/js-client-rest";
import { createClient } from "@libsql/client";

const qdrant = new QdrantClient({ url: "http://localhost:6333" });
const db = createClient({ url: "file:local.db" });

async function run() {
  const query = "フィジカルAI";
  const expandedKeywords = `半導体, MEMS, IMU, モーター, センサー, カメラ, ロボティクス, エッジコンピューティング, AIチップ, 触覚デバイス, 機械学習, ディープラーニング, 制御アルゴリズム, データ解析, クラウドプラットフォーム, シミュレーション, ビジョンプロセッシング, 強化学習, オブジェクト認識, リアルタイム処理, ロボット, ドローン, 自動運転, ヘルスケアロボット, スポーツ支援, 産業用オートメーション, リハビリテーション, スマートホーム, エンターテインメント, 教育`;
  
  const embedPrompt = `${query} ${expandedKeywords}`;
  
  // 1. Embed
  const embedRes = await fetch("http://localhost:11434/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "bge-m3", prompt: embedPrompt })
  });
  const embedData = await embedRes.json();
  const embedding = embedData.embedding;

  // 2. Search Qdrant
  const searchRes = await qdrant.search("company_profiles", {
    vector: embedding,
    limit: 50,
    with_payload: true
  });

  const tickers = searchRes.map(res => String(res.payload?.ticker));
  const placeholders = tickers.map(() => '?').join(',');
  
  const sql = `
    SELECT s.*, m.name, m.summary, m.theme_keywords
    FROM stocks s
    JOIN equities_master m ON s.ticker = m.ticker
    WHERE s.ticker IN (${placeholders})
    AND m.name NOT LIKE '%ETF%'
    AND m.name NOT LIKE '%ＥＴＦ%'
    AND m.name NOT LIKE '%投信%'
    AND m.name NOT LIKE '%投資法人%'
    AND m.name NOT LIKE '%ファンド%'
    AND m.name NOT LIKE '%ブル%'
    AND m.name NOT LIKE '%ベア%'
  `;
  const dbRes = await db.execute({ sql, args: tickers });
  
  const kwList = expandedKeywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(k => k);

  const qdrantScoreMap = new Map();
  searchRes.forEach(r => qdrantScoreMap.set(r.payload?.ticker, r.score));

  const finalResults = dbRes.rows.map(row => {
    const denseScore = qdrantScoreMap.get(row.ticker) || 0;
    let sparseScore = 0;

    if (kwList.length > 0) {
      const summary = String(row.summary || '').toLowerCase();
      const keywords = String(row.theme_keywords || '').toLowerCase();
      
      kwList.forEach((kw: string) => {
        if (summary.includes(kw)) sparseScore += 0.05;
        if (keywords.includes(kw)) sparseScore += 0.1;
      });
    }

    return {
      ticker: row.ticker,
      name: row.name,
      hybrid: denseScore + sparseScore,
      dense: denseScore,
      sparse: sparseScore
    };
  }).sort((a: any, b: any) => b.hybrid - a.hybrid).slice(0, 20);

  console.log("Top 20 Hybrid Search Results:");
  finalResults.forEach((r, i) => {
    console.log(`${i+1}. [${r.ticker}] ${r.name} - Hybrid: ${r.hybrid.toFixed(3)} (Dense: ${r.dense.toFixed(3)}, Sparse: ${r.sparse.toFixed(3)})`);
  });
}

run().catch(console.error);
