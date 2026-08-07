import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getEmbedding } from './rag/embedder';
import crypto from 'crypto';

const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });
const COLLECTION_NAME = 'gics_categories';

async function main() {
  console.log(`Re-initializing Qdrant collection: ${COLLECTION_NAME}...`);
  
  const collections = await qdrant.getCollections();
  if (collections.collections.some(c => c.name === COLLECTION_NAME)) {
    console.log("Deleting existing collection...");
    await qdrant.deleteCollection(COLLECTION_NAME);
  }

  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: {
      size: 1024, // bge-m3
      distance: 'Cosine'
    }
  });

  const dataPath = path.join(process.cwd(), 'src', 'data', 'gics_categories.json');
  const rawData = await fs.readFile(dataPath, 'utf8');
  const categories = JSON.parse(rawData);

  console.log(`Embedding ${categories.length} categories...`);
  
  const points = [];
  for (const cat of categories) {
    if (cat.sub_industry_id.startsWith('6010')) {
      continue; // Skip REITs
    }

    const textToEmbed = `【カテゴリ名】\n${cat.category_name}\n\n【説明】\n${cat.description}`;
    const vector = await getEmbedding(textToEmbed);
    
    // UUID from ID
    const hash = crypto.createHash('md5').update(cat.sub_industry_id).digest('hex');
    const uuid = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-8${hash.substring(17,20)}-${hash.substring(20,32)}`;

    points.push({
      id: uuid,
      vector: vector,
      payload: {
        id: cat.sub_industry_id,
        name: cat.category_name,
        description: cat.description,
        text: textToEmbed
      }
    });
    
    console.log(`Embedded: ${cat.category_name} (${cat.sub_industry_id})`);
  }

  if (points.length > 0) {
    await qdrant.upsert(COLLECTION_NAME, { points });
    console.log(`Upserted ${points.length} vectors to Qdrant.`);
  }
}

main().catch(console.error);
