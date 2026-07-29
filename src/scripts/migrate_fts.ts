import { createClient } from "@libsql/client";

async function run() {
  const db = createClient({ url: "file:local.db" });

  console.log("Starting FTS5 migration...");

  try {
    // 1. Create FTS5 virtual table
    console.log("Creating equities_fts virtual table...");
    await db.execute(`DROP TABLE IF EXISTS equities_fts;`);
    await db.execute(`
      CREATE VIRTUAL TABLE equities_fts 
      USING fts5(ticker, summary, theme_keywords, tokenize='trigram');
    `);

    // 2. Populate FTS5 table
    console.log("Populating equities_fts...");
    await db.execute(`
      INSERT INTO equities_fts(ticker, summary, theme_keywords)
      SELECT ticker, summary, theme_keywords FROM equities_master;
    `);

    // 3. Create triggers to keep it synced
    console.log("Creating triggers...");
    
    // Trigger for INSERT
    await db.execute(`DROP TRIGGER IF EXISTS equities_fts_ai;`);
    await db.execute(`
      CREATE TRIGGER equities_fts_ai AFTER INSERT ON equities_master BEGIN
        INSERT INTO equities_fts(ticker, summary, theme_keywords) 
        VALUES (new.ticker, new.summary, new.theme_keywords);
      END;
    `);

    // Trigger for DELETE
    await db.execute(`DROP TRIGGER IF EXISTS equities_fts_ad;`);
    await db.execute(`
      CREATE TRIGGER equities_fts_ad AFTER DELETE ON equities_master BEGIN
        DELETE FROM equities_fts WHERE ticker = old.ticker;
      END;
    `);

    // Trigger for UPDATE
    await db.execute(`DROP TRIGGER IF EXISTS equities_fts_au;`);
    await db.execute(`
      CREATE TRIGGER equities_fts_au AFTER UPDATE ON equities_master BEGIN
        UPDATE equities_fts 
        SET summary = new.summary, theme_keywords = new.theme_keywords 
        WHERE ticker = old.ticker;
      END;
    `);

    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

run();
