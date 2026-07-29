const fs = require('fs');
const { createClient } = require('@libsql/client');
const db = createClient({ url: 'file:local.db' });
async function run() {
  const gicsData = JSON.parse(fs.readFileSync('src/data/gics_categories.json', 'utf8'));
  const gicsMap = new Map();
  gicsData.forEach(c => gicsMap.set(c.sub_industry_id, c.category_name));

  const tickers = ['80580', '68040', '65010', '13750', '67580', '13010', '47480'];
  const res = await db.execute('SELECT ticker, name, gics_sub_industry_id, theme FROM equities_master WHERE ticker IN (' + tickers.map(t => '\\'' + t + '\\'').join(',') + ')');
  
  for (const row of res.rows) {
    const subName = gicsMap.get(row.gics_sub_industry_id) || 'Unknown';
    console.log(row.name + ' (' + row.ticker + '): ' + subName + ' (' + row.theme + ')');
  }
}
run();
