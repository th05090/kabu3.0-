import * as cheerio from 'cheerio';

async function testSearch() {
  const url = 'https://irbank.net/td/search?q=%E4%BA%8B%E6%A5%AD%E9%96%8B%E5%A7%8B';
  console.log(`Fetching: ${url}`);
  
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const results = [];
  $('.text-left').each((i, el) => {
    const title = $(el).find('a').text().trim();
    const href = $(el).find('a').attr('href');
    const tr = $(el).closest('tr');
    const date = tr.find('td').eq(0).text().trim();
    const ticker = tr.find('td').eq(1).text().trim();
    
    if (href) {
        results.push({ date, ticker, title, href });
    }
  });
  
  console.log(results.slice(0, 10));
}

testSearch();
