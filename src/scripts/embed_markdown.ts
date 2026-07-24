import * as fs from 'fs/promises';
import * as path from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrant = new QdrantClient({ url: 'http://localhost:6333' });
const COLLECTION_NAME = 'earnings_reports';
const EMBEDDING_MODEL = 'bge-m3';
const VECTOR_DIM = 1024; // bge-m3 is 1024 dims

// --- 1. Markdown Parsing & Semantic Chunking ---
type Chunk = {
  h1: string;
  h2: string;
  h3: string;
  text: string;
};

async function parseMarkdownToChunks(markdown: string): Promise<Chunk[]> {
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
    // Ignore the page delimiters we added
    if (line.trim().startsWith('<!-- PAGE')) continue;

    const h1Match = line.match(/^#\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

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
      // It's normal text or table
      currentTextBuffer.push(line);
    }
  }
  
  // Flush the last chunk
  flushChunk();
  return chunks;
}

// --- 2. Ollama Embeddings ---
async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    })
  });
  
  if (!response.ok) {
    throw new Error(`Ollama Embedding error: ${response.statusText}`);
  }
  const data = await response.json();
  return data.embedding;
}

// --- 3. Main Process ---
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: npx tsx src/scripts/embed_markdown.ts <ticker> <period>");
    process.exit(1);
  }
  const ticker = args[0];
  const period = args[1]; // e.g., 'latest' or 'prev'

  // 1. Ensure collection exists
  console.log(`[1] Ensuring Qdrant collection '${COLLECTION_NAME}' exists...`);
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.find(c => c.name === COLLECTION_NAME);
    if (!exists) {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: { size: VECTOR_DIM, distance: 'Cosine' },
      });
      console.log(`  -> Created collection '${COLLECTION_NAME}' (dim: ${VECTOR_DIM})`);
    } else {
      console.log(`  -> Collection '${COLLECTION_NAME}' already exists.`);
    }
  } catch (err: any) {
    console.error(`Failed to connect to Qdrant or create collection: ${err.message}`);
    process.exit(1);
  }

  // 2. Load Markdown
  const mdPath = path.join(process.cwd(), 'data', 'md', `${ticker}_${period}.md`);
  let markdown = '';
  try {
    markdown = await fs.readFile(mdPath, 'utf-8');
  } catch (err: any) {
    console.error(`Failed to read Markdown file ${mdPath}: ${err.message}`);
    process.exit(1);
  }

  // 3. Semantic Chunking
  console.log(`[2] Parsing and chunking Markdown semantically...`);
  const chunks = await parseMarkdownToChunks(markdown);
  console.log(`  -> Generated ${chunks.length} semantic chunks.`);

  // 4. Embedding and Upserting
  console.log(`[3] Embedding chunks and saving to Qdrant...`);
  const points = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const contextStr = `[${ticker}] ${chunk.h1} > ${chunk.h2} > ${chunk.h3}`.replace(/ > $/, '').trim();
    const textToEmbed = `${contextStr}\n${chunk.text}`;

    process.stdout.write(`  -> Embedding chunk ${i+1}/${chunks.length}... \r`);
    
    let safeTextToEmbed = textToEmbed;
    if (safeTextToEmbed.length > 4000) {
      safeTextToEmbed = safeTextToEmbed.slice(0, 4000) + '... (truncated for embedding)';
      console.log(`\n    [Warning] Chunk ${i+1} truncated from ${textToEmbed.length} to 4000 chars to avoid context overflow.`);
    }

    try {
      const vector = await getEmbedding(safeTextToEmbed);
      const id = crypto.randomUUID();

      points.push({
        id,
        vector,
        payload: {
          ticker,
          period, // <--- Add period metadata
          h1: chunk.h1,
          h2: chunk.h2,
          h3: chunk.h3,
          text: chunk.text,
        }
      });
    } catch (err: any) {
      console.error(`\n    [Error] Failed to embed chunk ${i+1}: ${err.message}. Skipping.`);
    }
  }
  console.log(`\n  -> Finished embedding. Upserting to Qdrant...`);

  // 5. Upsert
  await qdrant.upsert(COLLECTION_NAME, {
    wait: true,
    points,
  });

  console.log(`[4] Success! Uploaded ${points.length} vectors for ${ticker}_${period} to Qdrant.`);
}

main();
