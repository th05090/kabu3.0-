
import { QdrantClient } from '@qdrant/js-client-rest';

const EMBED_URL = 'http://localhost:11434/api/embeddings';
const qdrant = new QdrantClient({ url: 'http://localhost:6333' });

async function getEmbedding(text: string) {
  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'bge-m3', prompt: text })
  });
  const data = await res.json();
  return data.embedding;
}

async function run() {
  const queries = [
    '事業セグメント別',
    '報告セグメント別',
    'セグメント情報'
  ];
  const tickers = [
    { code: '13010', name: '極洋' },
    { code: '65010', name: '日立製作所' },
    { code: '13750', name: 'ユキグニファクトリー' }
  ];

  for (const q of queries) {
    console.log('\n####################################################');
    console.log('Query: [' + q + ']');
    const vector = await getEmbedding(q);

    for (const t of tickers) {
      console.log('\n--- Ticker: ' + t.code + ' (' + t.name + ') ---');
      const searchRes = await qdrant.search('earnings_reports', {
        vector: vector,
        limit: 10,
        filter: { must: [{ key: 'ticker', match: { value: t.code } }] },
        with_payload: true
      });

      searchRes.forEach((hit, idx) => {
        const text = (hit.payload?.text as string).replace(/\n/g, ' ');
        const preview = text.substring(0, 100);
        console.log('Rank ' + (idx+1) + ' (Score: ' + hit.score.toFixed(3) + ') - ' + preview);
      });
    }
  }
}
run();
