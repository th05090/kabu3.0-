import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GICS_DICTIONARY } from '../data/gics_dictionary';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });
const EMBED_URL = "http://localhost:11434/api/embeddings";

function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

function generateUuidForGics(gicsId: string): string {
  const hex = Buffer.from(gicsId).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "bge-m3", prompt: text })
  }).then(r => r.json());
  return res.embedding;
}

async function initGicsCollection() {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(c => c.name === "gics_categories");
  if (!exists) {
    console.log("Creating gics_categories collection...");
    await qdrant.createCollection("gics_categories", {
      vectors: { size: 1024, distance: "Cosine" }
    });
  }

  const dataPath = path.join(process.cwd(), 'src', 'data', 'gics_categories.json');
  const rawData = await fs.readFile(dataPath, 'utf8');
  const categories = JSON.parse(rawData);

  console.log(`Checking/Embedding ${categories.length} GICS categories...`);
  
  // To keep it simple, we just upsert all of them. Upsert is idempotent.
  const points = [];
  for (const cat of categories) {
    const text = `【カテゴリ名】\n${cat.category_name}\n\n【事業内容】\n${cat.description}`;
    const embedding = await getEmbedding(text);
    points.push({
      id: generateUuidForGics(cat.sub_industry_id),
      vector: embedding,
      payload: {
        sub_industry_id: cat.sub_industry_id,
        category_name: cat.category_name,
        description: cat.description
      }
    });
  }

  await qdrant.upsert("gics_categories", {
    wait: true,
    points: points
  });
  console.log("GICS categories successfully embedded and stored in Qdrant.");
}

async function main() {
  console.log("--- Starting GICS Classification Batch ---");
  
  // 1. Initialize and embed GICS dictionary in Qdrant
  await initGicsCollection();

  try {
    await db.execute('ALTER TABLE equities_master ADD COLUMN gics_sub_industry_id TEXT');
    console.log("Added gics_sub_industry_id column to equities_master.");
  } catch (e: any) {
    if (!e.message.includes("duplicate column")) {
      // ignore
    }
  }

  // 2. Fetch all companies that have a summary
  const targetsResult = await db.execute(`
    SELECT ticker, name FROM equities_master 
    WHERE summary IS NOT NULL AND gics_sub_industry_id IS NULL
  `);

  const targets = targetsResult.rows;
  console.log(`Found ${targets.length} companies to classify.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const ticker = String(t.ticker);
    
    if (i % 100 === 0) {
      console.log(`Processing ${i + 1}/${targets.length}...`);
    }

    try {
      const companyId = generateUuidForTicker(ticker);
      
      // Get the company's vector from Qdrant
      const points = await qdrant.retrieve("company_profiles", {
        ids: [companyId],
        with_vector: true
      });

      if (points.length === 0 || !points[0].vector) {
        console.error(`[Warning] No vector found in Qdrant for ticker ${ticker}. Skipping.`);
        failCount++;
        continue;
      }

      const vector = points[0].vector;

      // Search against gics_categories
      const searchRes = await qdrant.search("gics_categories", {
        vector: vector as number[],
        limit: 1,
        with_payload: true
      });

      if (searchRes.length > 0) {
        const bestMatch = searchRes[0];
        const subIndustryId = bestMatch.payload?.sub_industry_id as string;
        const gicsInfo = GICS_DICTIONARY[subIndustryId];

        if (gicsInfo) {
          const theme = gicsInfo.sector_name; // 主幹テーマとして大分類（セクター）を保存

          await db.execute({
            sql: "UPDATE equities_master SET theme = ?, gics_sub_industry_id = ? WHERE ticker = ?",
            args: [theme, subIndustryId, ticker]
          });
          
          successCount++;
        } else {
          console.error(`[Warning] Sub-industry ID ${subIndustryId} not found in TS dictionary for ticker ${ticker}.`);
          failCount++;
        }
      } else {
        console.error(`[Warning] No GICS match found for ticker ${ticker}.`);
        failCount++;
      }
    } catch (e) {
      console.error(`[Error] Failed processing ticker ${ticker}:`, e);
      failCount++;
    }
  }

  console.log(`\n--- Classification Complete ---`);
  console.log(`Total Success: ${successCount}`);
  console.log(`Total Failed/Skipped: ${failCount}`);
}

main().catch(console.error);
