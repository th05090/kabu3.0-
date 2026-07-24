import * as dotenv from 'dotenv';
import { syncJQuants } from '../lib/jquants';

dotenv.config({ path: '.env.local' });

async function main() {
  await syncJQuants();
}

main().catch(console.error);
