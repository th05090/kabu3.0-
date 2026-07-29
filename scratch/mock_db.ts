import { createClient } from '@libsql/client';

async function run() {
  const db = createClient({ url: 'file:local.db' });
  try {
    await db.execute("UPDATE equities_master SET gics_sub_industry_id = NULL WHERE ticker IN ('13010', '13770')");
    console.log("Updated DB manually for testing");
  } catch (e) {
    console.error(e);
  }
}
run();
