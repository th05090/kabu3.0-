
import { QdrantClient } from '@qdrant/js-client-rest';
import { pass1PromptTemplate } from '../src/scripts/rag/theme_prompts.js';

const EMBED_URL = 'http://localhost:11434/api/embeddings';
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const qdrant = new QdrantClient({ url: 'http://localhost:6333' });

async function askLLM_noFormat(prompt: string): Promise<string> {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma3:12b',
      prompt: prompt,
      stream: false,
      options: { temperature: 0.1 }
    })
  });
  const jsonRes = await res.json();
  return jsonRes.response.trim();
}

async function run() {
  const tickers = [
    { code: '13750', name: 'ユキグニファクトリー' },
    { code: '68040', name: 'ホシデン' }
  ];

  const embResTable = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'bge-m3', prompt: '報告セグメント 売上高 利益 金額 表' })
  }).then(r => r.json());

  for (const t of tickers) {
    console.log('\n=======================================');
    console.log('Testing Ticker: ' + t.code + ' (' + t.name + ')');
    
    const searchResTable = await qdrant.search('earnings_reports', {
      vector: embResTable.embedding,
      limit: 2,
      filter: { must: [{ key: 'ticker', match: { value: t.code } }] },
      with_payload: true
    });

    let pass1Text = searchResTable.map(hit => hit.payload?.text || '').join('\n');
    console.log('[Qdrant] Retrieved text length: ' + pass1Text.length);
    
    let llmText1 = await askLLM_noFormat(pass1PromptTemplate(pass1Text));
    console.log('[Gemma without format:json] Raw output:\n' + llmText1);
  }
}
run();
