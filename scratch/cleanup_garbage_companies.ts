import { createClient } from "@libsql/client";
import { QdrantClient } from "@qdrant/js-client-rest";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const db = createClient({ url: process.env.DATABASE_URL || "file:local.db" });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });

async function run() {
  // Find all garbage companies that have a summary
  const res = await db.execute(`
    SELECT ticker, name FROM equities_master
    WHERE summary IS NOT NULL
      AND (
        name LIKE '%ETF%'
        OR name LIKE '%ETN%'
        OR name LIKE '%REIT%'
        OR name LIKE '%リート%'
        OR name LIKE '%ＥＴＦ%'
        OR name LIKE '%投資法人%'
        OR name LIKE '%ファンド%'
      )
  `);

  console.log(`Found ${res.rows.length} garbage companies to clean up.`);

  for (const row of res.rows) {
    const ticker = String(row.ticker);
    const name = String(row.name);
    console.log(`Cleaning up: ${name} (${ticker})`);

    // 1. Delete from Qdrant
    try {
      await qdrant.delete("company_profiles", {
        filter: {
          must: [
            { key: "ticker", match: { value: ticker } }
          ]
        }
      });
      console.log(`  - Deleted from Qdrant`);
    } catch (e: any) {
      console.log(`  - Failed to delete from Qdrant: ${e.message}`);
    }

    // 2. Clear from DB
    await db.execute({
      sql: `UPDATE equities_master 
            SET summary = NULL, 
                theme_keywords = NULL, 
                main_segment = NULL, 
                sub_segments = NULL, 
                gics_sub_industry_id = NULL, 
                theme = NULL 
            WHERE ticker = ?`,
      args: [ticker]
    });
    console.log(`  - Cleared DB fields`);
  }

  console.log("Cleanup complete.");
}

run().catch(console.error);
