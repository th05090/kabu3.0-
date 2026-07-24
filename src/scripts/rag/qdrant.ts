import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'crypto';
import { getEmbedding } from './embedder';
import { Chunk } from './chunker';

const QDRANT_URL = 'http://localhost:6333';
export const COLLECTION_NAME = 'financial_reports';

export const qdrant = new QdrantClient({ url: QDRANT_URL });

export async function initQdrant() {
  try {
    const collections = await qdrant.getCollections();
    if (!collections.collections.some(c => c.name === COLLECTION_NAME)) {
      console.log(`Creating Qdrant collection: ${COLLECTION_NAME}...`);
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 1024, // bge-m3 size
          distance: 'Cosine',
        },
      });
      // Create full-text BM25 index for the 'text' payload field to enable keyword hybrid search
      await qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'text',
        field_schema: {
          type: 'text',
          tokenizer: 'word',
          min_token_len: 2,
          max_token_len: 15,
          lowercase: true,
        },
      });
      console.log("Created Full-Text Payload Index on 'text' field.");
    }
  } catch (err: any) {
    console.error("Qdrant init error:", err.message);
  }
}

export async function indexChunks(chunks: Chunk[], period: 'prev' | 'latest', ticker: string) {
  console.log(`Embedding and indexing ${chunks.length} header-aware chunks for ${period}...`);
  const points = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].text;
    const vector = await getEmbedding(chunk);
    const id = crypto.createHash('md5').update(`${ticker}_${period}_${i}`).digest('hex');
    const uuid = `${id.substring(0,8)}-${id.substring(8,12)}-4${id.substring(13,16)}-8${id.substring(17,20)}-${id.substring(20,32)}`;
    
    points.push({
      id: uuid,
      vector: vector,
      payload: {
        ticker,
        period,
        text: chunk // Includes breadcrumbs
      }
    });
  }

  if (points.length > 0) {
    await qdrant.upsert(COLLECTION_NAME, { points });
  }
}

// True Hybrid Search (RRF - Reciprocal Rank Fusion) implemented in Node.js
export async function retrieveHybrid(ticker: string, period: 'prev' | 'latest', semanticQuery: string, exactKeyword: string, limit: number = 3): Promise<string[]> {
  const queryVector = await getEmbedding(semanticQuery);
  
  // 1. Dense (Semantic) Search
  const denseResults = await qdrant.search(COLLECTION_NAME, {
    vector: queryVector,
    limit: 15, // fetch more for RRF ranking
    filter: {
      must: [
        { key: "ticker", match: { value: ticker } },
        { key: "period", match: { value: period } }
      ]
    },
    with_payload: true
  });

  // 2. Sparse (Keyword) Search via Full-text index
  const sparseResults = await qdrant.scroll(COLLECTION_NAME, {
    filter: {
      must: [
        { key: "ticker", match: { value: ticker } },
        { key: "period", match: { value: period } },
        { key: "text", match: { text: exactKeyword } }
      ]
    },
    limit: 15,
    with_payload: true,
    with_vector: false
  });

  // 3. Reciprocal Rank Fusion (RRF)
  const rrfScores: Record<string, { score: number, text: string }> = {};
  const K = 60; // Standard constant for RRF

  // Apply Dense Rank
  denseResults.forEach((res, index) => {
    const rank = index + 1;
    const text = res.payload?.text as string;
    if (text) {
      rrfScores[String(res.id)] = { score: 1 / (K + rank), text };
    }
  });

  // Apply Sparse Rank
  if (sparseResults.points) {
    sparseResults.points.forEach((res, index) => {
      const rank = index + 1;
      const text = res.payload?.text as string;
      if (text) {
        if (!rrfScores[String(res.id)]) {
          rrfScores[String(res.id)] = { score: 0, text };
        }
        rrfScores[String(res.id)].score += (1 / (K + rank));
      }
    });
  }

  // Sort by RRF Score descending
  const sortedIds = Object.keys(rrfScores).sort((a, b) => rrfScores[b].score - rrfScores[a].score);
  
  return sortedIds.slice(0, limit).map(id => rrfScores[id].text);
}
