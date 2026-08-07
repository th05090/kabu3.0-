import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

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

export async function scrapeIRBank(fullTicker: string, dateStr: string = 'latest') {
  try {
    const ticker4 = fullTicker.substring(0, 4);
    const listUrl = `https://irbank.net/${ticker4}/ir`;
    console.log(`[1] Fetching IR list for ${fullTicker} (IR Bank: ${ticker4}): ${listUrl}`);
    const listHtml = await fetchHtml(listUrl);
    const $list = cheerio.load(listHtml);

    // IR BANK specific logic: Find links containing '決算短信'
    let targetDetailUrl: string = '';
    let reportName = '';
    
    $list('a').each((i, el) => {
      const text = $list(el).text().trim();
      const href = $list(el).attr('href');
      
      // Look for "決算短信" and explicitly exclude "修正", "訂正", "補足"
      if (text.includes('決算短信') && !text.includes('修正') && !text.includes('訂正') && !text.includes('補足')) {
        // Find the most recent one (first one that matches)
        if (!targetDetailUrl && href) {
          targetDetailUrl = href;
          reportName = text;
        }
      }
    });

    if (!targetDetailUrl) {
      console.log(`No valid '決算短信' found for ${fullTicker} on IR BANK.`);
      return;
    }

    // Resolve relative URL if needed
    if (typeof targetDetailUrl === 'string' && targetDetailUrl.startsWith('/')) {
      targetDetailUrl = `https://irbank.net${targetDetailUrl}`;
    }

    console.log(`[2] Found detail page: ${reportName} -> ${targetDetailUrl}`);
    
    // Now fetch detail page to find direct PDF link
    const detailHtml = await fetchHtml(targetDetailUrl);
    const $detail = cheerio.load(detailHtml);
    
    let pdfUrl: string | null = null;
    $detail('a').each((i, el) => {
      const href = $detail(el).attr('href');
      // Look for the direct PDF link (usually starts with https://f.irbank.net/pdf/ or ends with .pdf)
      if (href && (href.includes('f.irbank.net/pdf') || href.endsWith('.pdf'))) {
        pdfUrl = href;
        return false; // Break the each loop
      }
    });

    if (!pdfUrl) {
      console.log(`Could not find direct PDF link on the detail page.`);
      return;
    }

    console.log(`[3] Found PDF URL: ${pdfUrl}`);

    // Create pdfs/[fullTicker] directory if not exists
    const tickerPdfDir = path.join(process.cwd(), 'data', 'pdfs', fullTicker);
    await fs.mkdir(tickerPdfDir, { recursive: true });

    // Extract actual date from IR Bank ID (e.g. 140120260417505829 -> 2026-04-17)
    let actualDate = dateStr;
    const dateMatch = targetDetailUrl.match(/\d{4}(\d{8})/);
    if (dateMatch) {
      const rawDate = dateMatch[1]; // 20260417
      const yyyy = rawDate.slice(0, 4);
      const mm = rawDate.slice(4, 6);
      const dd = rawDate.slice(6, 8);
      actualDate = `${yyyy}-${mm}-${dd}`;
    }

    const outputPath = path.join(tickerPdfDir, `${fullTicker}_${actualDate}.pdf`);
    
    // Check if it already exists
    try {
      await fs.access(outputPath);
      console.log(`[4] PDF already exists at ${outputPath}. Skipping download.`);
      return outputPath;
    } catch {
      // File doesn't exist, proceed to download
    }

    console.log(`[4] Downloading PDF to ${outputPath}...`);
    await downloadPdf(pdfUrl, outputPath);
    
    console.log(`Success! PDF for ${fullTicker} successfully downloaded.`);

    return outputPath;
  } catch (err: any) {
    console.error(`Error processing ${fullTicker}:`, err.message);
    throw err;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npx tsx src/scripts/fetch_pdf.ts <ticker>");
    process.exit(1);
  }
  
  const ticker = args[0];
  const dateStr = args[1] || 'latest';
  await scrapeIRBank(ticker, dateStr);
}

// Only run main if called directly
if (require.main === module) {
  main();
}
