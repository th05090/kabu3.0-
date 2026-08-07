import { createClient } from '@libsql/client';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';

const DB_URL = process.env.DATABASE_URL || 'file:local.db';
const DATA_DIR = path.join(process.cwd(), 'data', 'pdfs');

// Helper: Random sleep (jitter)
const randomSleep = async (min = 3000, max = 5000) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`Waiting for ${ms}ms...`);
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function fetchHtml(url: string) {
  await randomSleep();
  const res = await fetch(url, { headers: COMMON_HEADERS });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.text();
}

async function downloadPdf(url: string, outputPath: string) {
  await randomSleep();
  const res = await fetch(url, { headers: COMMON_HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to download PDF: HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(outputPath, buffer);
  console.log(`Saved PDF to: ${outputPath} (${buffer.length} bytes)`);
}

function parseJapaneseDate(str: string): Date | null {
  const match = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  return null;
}

export async function fetchAllIRNewsGlobal(limitDays: number = 5) {
  const db = createClient({ url: DB_URL });
  const keywords = ["新規事業", "事業開始", "参入"];
  
  for (const keyword of keywords) {
    const encodedKeyword = encodeURIComponent(keyword);
    const searchUrl = `https://irbank.net/td/search?q=${encodedKeyword}`;
    console.log(`[IR Global Search] Fetching for keyword "${keyword}": ${searchUrl}`);
    
    let html = "";
    try {
      html = await fetchHtml(searchUrl);
    } catch (e: any) {
      console.error(`Failed to fetch search results for ${keyword}: ${e.message}`);
      continue;
    }

    const $ = cheerio.load(html);
    let currentDate: Date | null = null;
    let stopKeyword = false;

    // Use a basic for-loop on elements so we can break early
    const rows = $('table.cs tr').toArray();
    for (const el of rows) {
      if (stopKeyword) break;

      const dateTd = $(el).find('td.lf');
      if (dateTd.length > 0) {
        currentDate = parseJapaneseDate(dateTd.text().trim());
        if (currentDate) {
           const daysDiff = (Date.now() - currentDate.getTime()) / (1000 * 60 * 60 * 24);
           if (daysDiff > limitDays) {
              console.log(`  => Reached date ${dateTd.text().trim()} which is older than ${limitDays} days. Stopping search for "${keyword}".`);
              stopKeyword = true;
           }
        }
      } else if (!stopKeyword) {
        const tds = $(el).find('td');
        if (tds.length >= 4) {
          let ticker = $(tds[1]).find('a').text().trim();
          const titleLink = $(tds[3]).find('a');
          const title = titleLink.text().trim();
          const href = titleLink.attr('href');
          
          if (ticker && href) {
            // IR Bank ticker might be 4 digits. Make it 5 digits if needed.
            if (ticker.length === 4) {
               ticker = ticker + "0"; // e.g. 1301 -> 13010
            }
            
            let dateStr = currentDate ? currentDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const pdfId = href.split('/').pop() || Date.now().toString();
            const fullId = `${ticker}_${pdfId}`;
            
            // Check if it already exists
            const existing = await db.execute({
              sql: 'SELECT id FROM ir_news WHERE id = ?',
              args: [fullId]
            });
            
            if (existing.rows.length > 0) {
              console.log(`  => Already have ${ticker} : ${title}`);
              continue;
            }

            console.log(`  => [NEW] Found: ${dateStr} ${ticker} - ${title}`);
            
            // Need to fetch PDF
            const detailUrl = `https://irbank.net${href}`;
            console.log(`     Fetching detail: ${detailUrl}`);
            const detailHtml = await fetchHtml(detailUrl);
            const $detail = cheerio.load(detailHtml);
            
            let pdfUrl = '';
            $detail('a').each((i, ael) => {
              const dhref = $detail(ael).attr('href');
              if (dhref && dhref.endsWith('.pdf')) {
                pdfUrl = dhref.startsWith('http') ? dhref : `https://f.irbank.net${dhref}`;
              }
            });

            if (!pdfUrl) {
              console.log(`     No PDF URL found on detail page.`);
              continue;
            }

            const tickerDir = path.join(DATA_DIR, ticker);
            if (!existsSync(tickerDir)) {
              await fs.mkdir(tickerDir, { recursive: true });
            }

            const pdfFilename = `${ticker}_ir_newbiz_${dateStr}_${pdfId}.pdf`;
            const pdfPath = path.join(tickerDir, pdfFilename);

            console.log(`     Downloading PDF: ${pdfUrl}`);
            await downloadPdf(pdfUrl, pdfPath);

            await db.execute({
              sql: 'INSERT INTO ir_news (id, ticker, title, date, pdf_path, analyzed) VALUES (?, ?, ?, ?, ?, 0)',
              args: [fullId, ticker, title, dateStr, pdfPath]
            });
            console.log(`     Saved to DB.`);
          }
        }
      }
    }
  }
}

if (require.main === module) {
  fetchAllIRNewsGlobal().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
