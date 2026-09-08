import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { calculateAndPopulateSepa } from '../lib/sepa/index';

async function main() {
  console.log('=== Starting Minervini SEPA Manual Calculation CLI ===');
  const startTime = Date.now();

  try {
    const res = await calculateAndPopulateSepa((msg) => console.log(`[Progress] ${msg}`));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== SEPA Calculation Finished in ${elapsed}s ===`, res);
  } catch (err) {
    console.error('SEPA Calculation Failed:', err);
    process.exit(1);
  }
}

main();
