import { createClient } from "@libsql/client";
import * as fs from "fs/promises";
import * as path from "path";

async function run() {
  const db = createClient({ url: "file:local.db" });

  console.log("Starting GICS FTS5 migration...");

  try {
    // 1. Create FTS5 virtual table
    console.log("Creating gics_fts virtual table...");
    await db.execute(`DROP TABLE IF EXISTS gics_fts;`);
    await db.execute(`
      CREATE VIRTUAL TABLE gics_fts 
      USING fts5(sub_industry_id, category_name, description, tokenize='trigram');
    `);

    // 2. Load and insert data
    const dataPath = path.join(process.cwd(), 'src', 'data', 'gics_categories.json');
    const rawData = await fs.readFile(dataPath, 'utf8');
    const categories = JSON.parse(rawData);

    console.log(`Inserting ${categories.length} categories into FTS5...`);
    for (const cat of categories) {
      if (cat.sub_industry_id.startsWith('6010')) {
        continue; // Skip REITs as per existing logic
      }
      await db.execute({
        sql: `INSERT INTO gics_fts(sub_industry_id, category_name, description) VALUES (?, ?, ?)`,
        args: [cat.sub_industry_id, cat.category_name, cat.description]
      });
    }

    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

run();
