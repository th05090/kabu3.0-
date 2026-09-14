import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import fs from 'fs';
import path from 'path';

const db = createClient({ url: process.env.DATABASE_URL || 'file:local.db' });
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });
const COLLECTION_NAME = 'earnings_reports';
const EMBED_URL = 'http://localhost:11434/api/embeddings';

export interface EarningsSearchResultItem {
  ticker: string;
  name: string;
  market: string;
  industry: string;
  currentPrice: number | null;
  period: string;
  section: string;
  snippet: string;
  pdfPath: string | null;
  score?: number;
}

// 各ティッカーのローカル最新決算日を取得（キャッシュ付き）
const latestDateCache = new Map<string, string>();
function getLatestDiskDate(ticker: string): string | null {
  if (latestDateCache.has(ticker)) return latestDateCache.get(ticker)!;

  const baseTicker = ticker.length > 4 ? ticker.slice(0, 4) : ticker;
  const candidateDirs = [
    path.join(process.cwd(), 'data', 'pdfs', ticker),
    path.join(process.cwd(), 'data', 'pdfs', `${baseTicker}0`),
    path.join(process.cwd(), 'data', 'pdfs', baseTicker),
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf') && !f.includes('ir_newbiz'));
        const dates = files
          .map((f) => {
            const m = f.match(/(\d{4}-\d{2}-\d{2})\.pdf$/);
            return m ? m[1] : null;
          })
          .filter(Boolean) as string[];

        if (dates.length > 0) {
          dates.sort().reverse();
          const latest = dates[0];
          latestDateCache.set(ticker, latest);
          return latest;
        }
      } catch {}
    }
  }
  return null;
}

// 該当PDFファイルの相対パスを解決
function resolvePdfPath(ticker: string, date: string): string | null {
  const baseTicker = ticker.length > 4 ? ticker.slice(0, 4) : ticker;
  const candidatePaths = [
    path.join('data', 'pdfs', ticker, `${ticker}_${date}.pdf`),
    path.join('data', 'pdfs', `${baseTicker}0`, `${baseTicker}0_${date}.pdf`),
    path.join('data', 'pdfs', baseTicker, `${baseTicker}_${date}.pdf`),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(path.join(process.cwd(), p))) {
      return p.replace(/\\/g, '/');
    }
  }

  // 日付が合致しない場合、そのティッカーの最新PDFへフォールバック
  const latestDate = getLatestDiskDate(ticker);
  if (latestDate && latestDate !== date) {
    return resolvePdfPath(ticker, latestDate);
  }
  return null;
}

// 検索キーワード周辺の抜粋スニペットを生成
function extractSnippet(text: string, keywords: string[], maxLength = 260): string {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
  if (keywords.length === 0) {
    return clean.slice(0, maxLength) + (clean.length > maxLength ? '...' : '');
  }

  // 最初のキーワードの出現位置を探す
  let firstIdx = -1;
  for (const kw of keywords) {
    const idx = clean.indexOf(kw);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  if (firstIdx === -1) {
    return clean.slice(0, maxLength) + (clean.length > maxLength ? '...' : '');
  }

  const start = Math.max(0, firstIdx - 40);
  const end = Math.min(clean.length, start + maxLength);
  let snippet = clean.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < clean.length) snippet = snippet + '...';
  return snippet;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const mode = body.mode === 'vector' ? 'vector' : 'and';
    const onlyLatest = body.onlyLatest !== false; // デフォルトtrue
    const limit = Math.min(Number(body.limit) || 30, 100);

    if (!query) {
      return NextResponse.json({ results: [], total: 0 });
    }

    let candidatePoints: any[] = [];
    const keywords = query.split(/\s+/).filter(Boolean);

    if (mode === 'and') {
      // AND条件キーワード検索 (Qdrant全文インデックス)
      const mustFilters = keywords.map((kw: string) => ({
        key: 'text',
        match: { text: kw },
      }));

      const scrollRes = await qdrant.scroll(COLLECTION_NAME, {
        filter: { must: mustFilters },
        limit: onlyLatest ? 120 : limit,
        with_payload: true,
      });

      candidatePoints = scrollRes.points || [];
    } else {
      // ベクトル検索 (bge-m3 1024次元)
      const embedRes = await fetch(EMBED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'bge-m3', prompt: query }),
      });

      if (!embedRes.ok) {
        throw new Error(`Embedding model error: ${embedRes.statusText}`);
      }

      const { embedding } = await embedRes.json();
      const searchRes = await qdrant.search(COLLECTION_NAME, {
        vector: embedding,
        limit: onlyLatest ? 100 : limit,
        with_payload: true,
      });

      candidatePoints = searchRes || [];
    }

    if (candidatePoints.length === 0) {
      return NextResponse.json({ results: [], total: 0 });
    }

    // 抽出されたティッカーの銘柄情報を一括取得
    const rawTickers = candidatePoints.map((p) => String(p.payload?.ticker)).filter(Boolean);
    const uniqueTickers = Array.from(new Set(rawTickers));

    const placeholders = uniqueTickers.map(() => '?').join(',');
    const stocksRes = await db.execute({
      sql: `SELECT ticker, name, market, industry, current_price, earnings_date FROM stocks WHERE ticker IN (${placeholders})`,
      args: uniqueTickers,
    });

    const stockMap = new Map<string, any>();
    for (const s of stocksRes.rows) {
      stockMap.set(String(s.ticker), s);
    }

    // フィルタリング & 同一銘柄の集約
    const filteredResults: EarningsSearchResultItem[] = [];
    const seenTickerMap = new Map<string, EarningsSearchResultItem>();

    for (const point of candidatePoints) {
      const payload = point.payload || {};
      const ticker = String(payload.ticker);
      const period = String(payload.period || '');
      const stock = stockMap.get(ticker);

      // 最新決算厳格フィルタリング
      if (onlyLatest) {
        const latestDisk = getLatestDiskDate(ticker);
        // period が 'latest' ではない場合、ディスク上の最新日付またはDBの開示日と照合
        if (period !== 'latest' && latestDisk && period !== latestDisk) {
          // 古い四半期チャンクは除外
          continue;
        }
      }

      // 同一銘柄がすでに登録されている場合はスコア比較（ベクトル検索なら高スコア優先）
      if (seenTickerMap.has(ticker)) {
        continue;
      }

      const rawText = String(payload.text || '');
      const section = String(payload.h2 || payload.h1 || '決算説明抜粋');
      const snippet = extractSnippet(rawText, keywords);
      const effectiveDate = period === 'latest' ? (getLatestDiskDate(ticker) || String(stock?.earnings_date || '最新期')) : period;
      const pdfPath = resolvePdfPath(ticker, effectiveDate);

      const item: EarningsSearchResultItem = {
        ticker,
        name: stock ? String(stock.name) : ticker,
        market: stock ? String(stock.market) : '-',
        industry: stock ? String(stock.industry) : '-',
        currentPrice: stock?.current_price != null ? Number(stock.current_price) : null,
        period: effectiveDate,
        section,
        snippet,
        pdfPath,
        score: point.score != null ? Math.round(point.score * 1000) / 1000 : undefined,
      };

      seenTickerMap.set(ticker, item);
      filteredResults.push(item);

      if (filteredResults.length >= limit) {
        break;
      }
    }

    return NextResponse.json({
      results: filteredResults,
      total: filteredResults.length,
      mode,
      onlyLatest,
    });
  } catch (error: any) {
    console.error('Earnings search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
