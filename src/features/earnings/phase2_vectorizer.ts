import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrant = new QdrantClient({ url: 'http://localhost:6333' });
const COLLECTION_NAME = 'earnings_reports';
const EMBEDDING_MODEL = 'bge-m3';
const VECTOR_DIM = 1024;

interface Chunk {
  h1: string;
  h2: string;
  h3: string;
  text: string;
}

function parseMarkdownToChunks(markdown: string): Chunk[] {
  const lines = markdown.split('\n');
  const chunks: Chunk[] = [];

  let currentH1 = '';
  let currentH2 = '';
  let currentH3 = '';
  let currentTextBuffer: string[] = [];

  const flushChunk = () => {
    const text = currentTextBuffer.join('\n').trim();
    if (text.length > 0) {
      chunks.push({
        h1: currentH1,
        h2: currentH2,
        h3: currentH3,
        text,
      });
    }
    currentTextBuffer = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('<!-- PAGE')) continue;

    const cleanLine = line.trim();
    const h1Match = cleanLine.match(/^#\s+(.+)$/);
    const h2Match = cleanLine.match(/^##\s+(.+)$/);
    const h3Match = cleanLine.match(/^###\s+(.+)$/);

    if (h1Match) {
      flushChunk();
      currentH1 = h1Match[1].trim();
      currentH2 = '';
      currentH3 = '';
    } else if (h2Match) {
      flushChunk();
      currentH2 = h2Match[1].trim();
      currentH3 = '';
    } else if (h3Match) {
      flushChunk();
      currentH3 = h3Match[1].trim();
    } else {
      currentTextBuffer.push(line);
    }
  }

  flushChunk();
  return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama Embedding error: ${response.statusText}`);
  }
  const data = await response.json();
  return data.embedding;
}

function generateUuid(seed: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0') +
              (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function ensureCollectionExists(): Promise<void> {
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.find((c) => c.name === COLLECTION_NAME);
    if (!exists) {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: { size: VECTOR_DIM, distance: 'Cosine' },
      });
      console.log(`[Phase 2] Created Qdrant collection '${COLLECTION_NAME}' (dim: ${VECTOR_DIM})`);
    }
  } catch (err: any) {
    console.error(`[Phase 2] Failed to check/create Qdrant collection: ${err.message}`);
  }
}

/**
 * Phase 2: 新規作成されたMarkdownテキストを読み込み、BGE-M3でベクトル化してQdrantへ直列保存する。
 * Docling終了後に直列実行されるため、CUDA VRAMの競合や多重起動は物理的に発生しない。
 */
export async function runPhase2(
  items: { ticker: string; date: string }[],
  onProgress?: (msg: string) => void
): Promise<number> {
  if (items.length === 0) return 0;

  console.log(`\n=== Phase 2: Vectorization & Qdrant Storage (${items.length} items) ===`);
  await ensureCollectionExists();

  let embeddedCount = 0;
  for (let i = 0; i < items.length; i++) {
    const { ticker, date } = items[i];
    const mdPath = path.join(process.cwd(), 'data', 'pdfs', ticker, `${ticker}_${date}.md`);

    if (!existsSync(mdPath)) {
      continue;
    }

    if (onProgress) {
      onProgress(`[フェーズ2: ${i + 1}/${items.length}] 決算ベクトル登録中: ${ticker} (${date})...`);
    }

    try {
      const markdown = await fs.readFile(mdPath, 'utf-8');
      const chunks = parseMarkdownToChunks(markdown);

      if (chunks.length === 0) continue;

      // 古い同一日付チャンクがあれば削除
      try {
        await qdrant.delete(COLLECTION_NAME, {
          filter: {
            must: [
              { key: 'ticker', match: { value: ticker } },
              { key: 'period', match: { value: date } },
            ],
          },
        });
      } catch {
        // Ignore deletion errors if not exist
      }

      const points = [];
      for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
        const chunk = chunks[cIdx];
        const contextStr = `[${ticker}] ${chunk.h1} > ${chunk.h2} > ${chunk.h3}`.replace(/ > $/, '').trim();
        const textToEmbed = `${contextStr}\n${chunk.text}`;

        try {
          const vector = await getEmbedding(textToEmbed);
          const pointId = generateUuid(`${ticker}_${date}_${cIdx}_${chunk.h2}`);

          points.push({
            id: pointId,
            vector,
            payload: {
              ticker,
              period: date,
              h1: chunk.h1,
              h2: chunk.h2,
              h3: chunk.h3,
              text: chunk.text,
            },
          });
        } catch (embedErr: any) {
          console.error(`  [Phase 2 Warning] Embedding failed for ${ticker} chunk ${cIdx}:`, embedErr.message);
        }
      }

      if (points.length > 0) {
        await qdrant.upsert(COLLECTION_NAME, {
          wait: true,
          points,
        });
      }

      embeddedCount++;
      console.log(`  => [Phase 2: ${i + 1}/${items.length}] ${ticker} (${date}) registered ${points.length} chunks to Qdrant`);
    } catch (err: any) {
      console.error(`  [Phase 2 Error] Failed to vectorize ${ticker} (${date}):`, err.message);
    }
  }

  return embeddedCount;
}
