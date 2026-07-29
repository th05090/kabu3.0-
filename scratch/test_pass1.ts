
import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { askLLM, pass1PromptTemplate } from '../src/scripts/rag/theme_prompts.js';

const EMBED_URL = 'http://localhost:11434/api/embeddings';
const qdrant = new QdrantClient({ url: 'http://localhost:6333' });

async function run() {
  const ticker5 = '13010'; // 極洋
  const embResTable = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'bge-m3', prompt: '報告セグメント 売上高 利益 金額 表' })
  }).then(r => r.json());

  const searchResTable = await qdrant.search('earnings_reports', {
    vector: embResTable.embedding,
    limit: 2,
    filter: { must: [{ key: 'ticker', match: { value: ticker5 } }] },
    with_payload: true
  });

  let pass1Text = searchResTable.map(hit => hit.payload?.text || '').join('\n');
  console.log('=== PASS 1 TEXT ===');
  console.log(pass1Text.substring(0, 500) + '...');

  console.log('\n=== LLM CALL ===');
  let llmText1 = await askLLM(pass1PromptTemplate(pass1Text), true);
  console.log('Raw LLM output:\n', llmText1);
}
run();
