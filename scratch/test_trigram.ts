import { createClient } from '@libsql/client';

async function run() {
  const db = createClient({ url: 'file:local.db' });
  try {
    await db.execute("CREATE VIRTUAL TABLE test_fts USING fts5(text, tokenize='trigram')");
    console.log('trigram supported');
    await db.execute('DROP TABLE test_fts');
  } catch(e) {
    console.error(e);
  }
}

run();
