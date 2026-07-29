import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';

async function run() {
  const db = createClient({ url: 'file:local.db' });
  const qdrant = new QdrantClient({ host: '127.0.0.1', port: 6333 });
  
  // 1. Get 13010 summary from DB
  const res = await db.execute("SELECT summary, theme_keywords FROM equities_master WHERE ticker = '13010'");
  if (res.rows.length === 0) {
    console.log("No data for 13010");
    return;
  }
  
  const summary = res.rows[0].summary;
  const keywords = res.rows[0].theme_keywords || '';
  const combinedText = `事業概要: ${summary}\nキーワード: ${keywords}`;
  console.log("Combined Text:", combinedText);
  
  // 2. Generate vector via Ollama bge-m3
  const ollamaRes = await fetch('http://127.0.0.1:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'bge-m3',
      prompt: combinedText
    })
  });
  
  const ollamaData = await ollamaRes.json();
  const vector = ollamaData.embedding;
  
  // 3. Query Qdrant gics_categories for top 5
  const searchResults = await qdrant.search('gics_categories', {
    vector: vector,
    limit: 5,
    with_payload: true
  });
  
  console.log("--- TOP 5 GICS ---");
  searchResults.forEach((r, i) => {
    console.log(`${i+1}. Score: ${r.score.toFixed(3)}, Category: ${r.payload?.category_name}`);
  });
}

run().catch(console.error);
