import { QdrantClient } from '@qdrant/js-client-rest';
import { createClient } from '@libsql/client';

async function run() {
  const db = createClient({ url: 'file:local.db' });
  const qdrant = new QdrantClient({ host: '127.0.0.1', port: 6333 });

  const tickers = ['130A0', '13770', '19820'];

  for (const ticker of tickers) {
    console.log(`\n======================================`);
    console.log(`Testing Ticker: ${ticker}`);
    console.log(`======================================`);
    
    // 1. Get summary from DB
    const res = await db.execute({
      sql: "SELECT name, industry, summary, theme_keywords FROM equities_master WHERE ticker = ?",
      args: [ticker]
    });
    if (res.rows.length === 0) {
      console.log(`Ticker ${ticker} not found in DB.`);
      continue;
    }
    
    const { name, industry, summary, theme_keywords } = res.rows[0];
    console.log(`Name: ${name} (東証: ${industry})`);
    console.log(`Summary: ${summary}`);
    console.log(`Keywords: ${theme_keywords}`);

    // 2. Dense Vector (bge-m3)
    const ollamaRes = await fetch('http://127.0.0.1:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'bge-m3', prompt: summary as string })
    });
    const ollamaData = await ollamaRes.json();
    const vector = ollamaData.embedding;

    // 3. Simulated Hybrid Scoring
    const searchResults = await qdrant.search('gics_categories', {
      vector: vector,
      limit: 30,
      with_payload: true
    });

    const kwList = (theme_keywords as string || '').split(',').map(k => k.trim()).filter(k => k);

    const hybridResults = searchResults.map(r => {
      const categoryName = String(r.payload?.category_name || '');
      
      // Simple keyword match score (Sparse simulation)
      let keywordScore = 0;
      kwList.forEach(kw => {
        if (categoryName.includes(kw)) keywordScore += 0.2;
        // Basic morphological heuristics
        if (kw.includes("食品") && categoryName.includes("食品")) keywordScore += 0.1;
        if (kw.includes("医療") && categoryName.includes("医療")) keywordScore += 0.1;
        if (kw.includes("医薬品") && categoryName.includes("医薬品")) keywordScore += 0.1;
        if (kw.includes("農業") && categoryName.includes("農")) keywordScore += 0.1;
        if (kw.includes("種苗") && categoryName.includes("農")) keywordScore += 0.1;
        if (kw.includes("設備") && categoryName.includes("設備")) keywordScore += 0.1;
        if (kw.includes("建設") && categoryName.includes("建設")) keywordScore += 0.1;
      });

      return {
        category: categoryName,
        denseScore: r.score,
        sparseScore: keywordScore,
        hybridScore: r.score + keywordScore
      };
    });

    hybridResults.sort((a, b) => b.hybridScore - a.hybridScore);

    console.log("\n--- TOP 5 HYBRID (Dense + Keyword Boost) ---");
    hybridResults.slice(0, 5).forEach((r, i) => {
      console.log(`${i+1}. Hybrid Score: ${r.hybridScore.toFixed(3)} (Dense: ${r.denseScore.toFixed(3)}, Sparse: ${r.sparseScore.toFixed(3)}) => ${r.category}`);
    });
  }
}

run().catch(console.error);
