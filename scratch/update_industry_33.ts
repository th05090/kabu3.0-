import * as dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config({ path: '.env.local' });

async function run() {
  const API_KEY = process.env.JQUANTS_API_KEY;
  const res = await fetch('https://api.jquants.com/v2/equities/master', {
    headers: { 'x-api-key': API_KEY! }
  });
  const data = await res.json();
  
  // The API response might have 'info' or just be an array, or something else.
  console.log("Keys:", Object.keys(data));
  const items = data.info || data.equities || data.data; // fallback
  
  if (items && Array.isArray(items)) {
    console.log("Success! Fetched", items.length, "companies.");
    const db = createClient({ url: 'file:local.db' });
    let count = 0;
    for (const comp of items) {
      const ticker = comp.Code;
      const sector33 = comp.Sector33CodeName || comp.S33Nm; // JQuants V2 changed keys!
      
      if (sector33 && sector33 !== '-' && sector33 !== 'その他') {
        const updateRes = await db.execute({
          sql: 'UPDATE equities_master SET industry = ? WHERE ticker = ?',
          args: [sector33, ticker]
        });
        if (updateRes.rowsAffected > 0) count++;
      }
    }
    console.log(`Updated ${count} companies to Sector33.`);
  } else {
    console.log(data);
  }
}
run();
