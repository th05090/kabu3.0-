import { QdrantClient } from '@qdrant/js-client-rest';
import { createClient } from '@libsql/client';

async function run() {
  const db = createClient({ url: 'file:local.db' });
  const qdrant = new QdrantClient({ host: '127.0.0.1', port: 6333 });

  // 1. Get 13010 summary from DB
  const res = await db.execute("SELECT summary, theme_keywords FROM equities_master WHERE ticker = '13010'");
  const summary = res.rows[0].summary;
  const keywords = res.rows[0].theme_keywords || '';
  console.log("Summary:", summary);
  console.log("Keywords:", keywords);

  // 2. Dense Vector (bge-m3)
  const ollamaRes = await fetch('http://127.0.0.1:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'bge-m3', prompt: summary as string })
  });
  const ollamaData = await ollamaRes.json();
  const vector = ollamaData.embedding;

  // 3. Simulated Hybrid Scoring
  // Since we don't have a Japanese tokenizer/sparse model in Node.js right now,
  // we will manually fetch the top 20 dense results from Qdrant,
  // and re-rank them locally using a keyword match score (Jaccard/TF-IDF simulation)
  // to prove the concept of "Hybrid Search" solving the issue!

  const searchResults = await qdrant.search('gics_categories', {
    vector: vector,
    limit: 30, // Get deeper results
    with_payload: true
  });

  const kwList = (keywords as string).split(',').map(k => k.trim()).filter(k => k);

  const hybridResults = searchResults.map(r => {
    const categoryName = String(r.payload?.category_name || '');
    const description = String(r.payload?.description || '');
    
    // Simple keyword match score (Sparse simulation)
    let keywordScore = 0;
    kwList.forEach(kw => {
      // If the category name or description contains the keyword, boost!
      if (categoryName.includes(kw)) keywordScore += 0.2;
      // Also check sub-strings for Japanese (e.g. "食品" in "業務用食品")
      if (kw.includes("食品") && categoryName.includes("食品")) keywordScore += 0.1;
      if (kw.includes("水産") && categoryName.includes("水産")) keywordScore += 0.1;
    });

    // Normalize dense score (typically 0.4 - 0.7) to 0-1 range for blending
    // bge-m3 dense score
    const denseScore = r.score;

    // Hybrid Score = Dense + Sparse
    const hybridScore = denseScore + keywordScore;

    return {
      category: categoryName,
      denseScore: denseScore,
      sparseScore: keywordScore,
      hybridScore: hybridScore,
      desc: description
    };
  });

  // Sort by Hybrid Score
  hybridResults.sort((a, b) => b.hybridScore - a.hybridScore);

  console.log("\n--- TOP 5 HYBRID (Dense + Keyword Boost) ---");
  hybridResults.slice(0, 5).forEach((r, i) => {
    console.log(`${i+1}. Hybrid Score: ${r.hybridScore.toFixed(3)} (Dense: ${r.denseScore.toFixed(3)}, Sparse: ${r.sparseScore.toFixed(3)}) => ${r.category}`);
  });
}

run().catch(console.error);
