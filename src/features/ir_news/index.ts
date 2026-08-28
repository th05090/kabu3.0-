import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { runPhase1Inference } from './phase1_inference';
import { runPhase2Vectorization } from './phase2_vectorization';

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });

export async function processIrNews(onProgress?: (msg: string) => void) {
  console.log("--- Starting IR News Processing ---");

  const unanalyzed = await db.execute('SELECT * FROM ir_news WHERE analyzed = 0');
  const rows = unanalyzed.rows;

  if (rows.length === 0) {
    console.log("No new IR news to analyze.");
    return;
  }

  console.log(`Found ${rows.length} IR news to analyze.`);

  // Phase 1: LLM Inference
  const parsedResults = await runPhase1Inference(rows, onProgress);

  if (parsedResults.length === 0) {
    console.log("\nNo parsed results to vectorize. Exiting.");
    return;
  }

  // Phase 2: Vectorization
  await runPhase2Vectorization(db, qdrant, parsedResults, onProgress);

  console.log("--- IR News Processing Complete ---");
}
