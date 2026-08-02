import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const db = createClient({ url: 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });

function generateUuidForTicker(ticker: string): string {
  const hex = Buffer.from(ticker).toString("hex").padEnd(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function run() {
  console.log("Starting anomaly score calculation...");

  // 1. Get all tickers with a GICS classification
  const result = await db.execute(`
    SELECT ticker, gics_sub_industry_id 
    FROM equities_master 
    WHERE gics_sub_industry_id IS NOT NULL
  `);

  const stocks = result.rows.map(r => ({
    ticker: String(r.ticker),
    gicsId: String(r.gics_sub_industry_id)
  }));

  console.log(`Found ${stocks.length} stocks with GICS classification.`);

  // Group by GICS ID
  const groupedStocks: Record<string, { ticker: string, vector: number[] }[]> = {};
  for (const stock of stocks) {
    if (!groupedStocks[stock.gicsId]) {
      groupedStocks[stock.gicsId] = [];
    }
    groupedStocks[stock.gicsId].push({ ticker: stock.ticker, vector: [] });
  }

  // 2. Fetch all vectors from Qdrant in batches
  const batchSize = 100;
  let fetchedCount = 0;
  for (let i = 0; i < stocks.length; i += batchSize) {
    const batch = stocks.slice(i, i + batchSize);
    const ids = batch.map(s => generateUuidForTicker(s.ticker));
    
    try {
      const points = await qdrant.retrieve("company_profiles", { ids, with_vector: true });
      for (const p of points) {
        if (!p.vector) continue;
        const ticker = batch.find(s => generateUuidForTicker(s.ticker) === p.id)?.ticker;
        if (!ticker) continue;
        
        const gicsId = batch.find(s => s.ticker === ticker)?.gicsId;
        if (!gicsId) continue;
        
        const target = groupedStocks[gicsId].find(s => s.ticker === ticker);
        if (target) {
          target.vector = p.vector as number[];
          fetchedCount++;
        }
      }
    } catch (e) {
      console.log(`Failed to fetch vector batch at index ${i}`);
    }
  }
  
  console.log(`Successfully fetched vectors for ${fetchedCount} stocks.`);

  // 3. Compute centroids and similarity for each group
  const updates: { ticker: string, score: number }[] = [];

  for (const [gicsId, group] of Object.entries(groupedStocks)) {
    // Filter out stocks whose vectors couldn't be fetched
    const validStocks = group.filter(s => s.vector.length > 0);
    if (validStocks.length === 0) continue;

    const vectorLength = validStocks[0].vector.length;
    const centroid = new Array(vectorLength).fill(0);
    
    for (const v of validStocks) {
      for (let i = 0; i < vectorLength; i++) {
        centroid[i] += v.vector[i];
      }
    }
    for (let i = 0; i < vectorLength; i++) {
      centroid[i] /= validStocks.length;
    }

    for (const v of validStocks) {
      const similarity = cosineSimilarity(centroid, v.vector);
      updates.push({ ticker: v.ticker, score: similarity });
    }
  }

  // 4. Update the database
  console.log(`Updating anomaly scores for ${updates.length} stocks...`);
  let updatedCount = 0;
  for (const update of updates) {
    await db.execute({
      sql: 'UPDATE equities_master SET gics_similarity_score = ? WHERE ticker = ?',
      args: [update.score, update.ticker]
    });
    updatedCount++;
    if (updatedCount % 500 === 0) {
      console.log(`Updated ${updatedCount}/${updates.length}...`);
    }
  }

  console.log("Anomaly score calculation completed successfully.");
}

run().catch(console.error);
