import { createClient } from '@libsql/client';
import * as zlib from 'zlib';
import { parse } from 'csv-parse';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const BASE_URL = 'https://api.jquants.com';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

async function fetchJQuants(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const apiKey = process.env.JQUANTS_API_KEY;
  if (!apiKey) throw new Error('JQUANTS_API_KEY is not set');

  console.log(`[J-Quants] Fetching: ${url}`);
  const res = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': apiKey,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

async function downloadAndProcessCsv(downloadUrl: string, onRow: (row: any) => Promise<void>) {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
  if (!res.body) throw new Error('No body in response');

  const nodeStream = Readable.fromWeb(res.body as any);
  const unzipStream = zlib.createGunzip();
  const csvStream = parse({
    columns: true,
    skip_empty_lines: true,
  });

  let count = 0;
  csvStream.on('readable', async () => {
    let row;
    while ((row = csvStream.read()) !== null) {
      count++;
      try {
        await onRow(row);
      } catch (err) {
        console.error('Error processing row:', row, err);
      }
    }
  });

  await pipeline(nodeStream, unzipStream, csvStream);
  console.log(`[J-Quants] Finished processing ${count} rows.`);
}

export async function syncJQuants() {
  console.log('--- J-Quants Data Sync Started ---');

  try {
    // 1. 上場銘柄一覧の取得
    const masterList = await fetchJQuants('/v2/bulk/list?endpoint=equities/master');
    const masterFiles = masterList.data || [];
    
    // 開発用: 最新の1ファイルのみ取得 (全件取得すると時間がかかるため)
    const latestMasterFile = masterFiles[masterFiles.length - 1];
    
    if (latestMasterFile) {
      console.log(`[J-Quants] Downloading Master File: ${latestMasterFile.Key}`);
      const getRes = await fetchJQuants(`/v2/bulk/get?key=${latestMasterFile.Key}`);
      
      await downloadAndProcessCsv(getRes.url, async (row) => {
        await db.execute({
          sql: `INSERT OR REPLACE INTO equities_master (ticker, name, market, industry, last_updated) VALUES (?, ?, ?, ?, ?)`,
          args: [row.Code, row.CoName, row.MktNm, row.S17Nm || row.S33Nm || '', new Date().toISOString()]
        });
      });
    }

    // 2. 財務データの取得 (fins/summary)
    const finsList = await fetchJQuants('/v2/bulk/list?endpoint=fins/summary');
    const finsFiles = (finsList.data || []).filter((f: any) => {
      return f.Key.includes('/2024/') || f.Key.includes('/2025/') || f.Key.includes('/2026/') || f.Key.includes('/live/');
    });
    console.log(`[J-Quants] Found ${finsFiles.length} financials files to process since 2024.`);
    finsFiles.sort((a: any, b: any) => a.Key.localeCompare(b.Key));

    for (const file of finsFiles) {
      console.log(`[J-Quants] Processing Financials: ${file.Key}`);
      const getRes = await fetchJQuants(`/v2/bulk/get?key=${file.Key}`);
      
      let batch: any[] = [];
      const BATCH_SIZE = 5000;
      const flushBatch = async () => {
        if (batch.length === 0) return;
        const transaction = batch.map(row => {
          const num = (v: any) => (v === '' || v == null) ? null : parseFloat(v);
          const eps = num(row.EPS) || num(row.NCEPS);
          const div = num(row.DivAnn) || num(row.FDivAnn) || num(row.FDivFY) || num(row.NxFDivAnn) || num(row.NxFDivFY);
          const shares = num(row.ShOutFY);
          
          return {
            sql: `INSERT OR REPLACE INTO financials 
                  (ticker, date, net_sales, operating_profit, profit, equity_to_asset_ratio, shares_outstanding, forecast_net_sales, forecast_operating_profit, forecast_profit, forecast_dividend, eps, adj_eps, adj_dividend, adj_shares_outstanding) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              row.Code, row.DiscDate, 
              num(row.Sales) || num(row.NCSales), num(row.OP) || num(row.NCOP), num(row.NP) || num(row.NCNP), 
              num(row.EqAR) || num(row.NCEqAR), shares,
              num(row.NxFSales) || num(row.FSales) || num(row.NxFNCSales) || num(row.FNCSales), 
              num(row.NxFOP) || num(row.FOP) || num(row.NxFNCOP) || num(row.FNCOP), 
              num(row.NxFNp) || num(row.FNP) || num(row.NxFNCNP) || num(row.FNCNP), div,
              eps, eps, div, shares
            ]
          };
        });
        await db.batch(transaction, 'write');
        batch = [];
      };

      await downloadAndProcessCsv(getRes.url, async (row) => {
        batch.push(row);
        if (batch.length >= BATCH_SIZE) await flushBatch();
      });
      await flushBatch();
    }

    // 3. 日足データの取得 (2024年以降を対象)
    const quotesList = await fetchJQuants('/v2/bulk/list?endpoint=equities/bars/daily');
    const quoteFiles = (quotesList.data || []).filter((f: any) => {
      // "equities/bars/daily/historical/2024/..." などの文字列から年を抽出してフィルタ
      return f.Key.includes('/2024/') || f.Key.includes('/2025/') || f.Key.includes('/2026/') || f.Key.includes('/live/');
    });

    console.log(`[J-Quants] Found ${quoteFiles.length} daily quote files to process since 2024.`);
    
    // 過去から順に処理するため昇順ソート (ファイル名は日付順になっている前提)
    quoteFiles.sort((a: any, b: any) => a.Key.localeCompare(b.Key));

    // ローカルSQLiteではバルク挿入が早いが、非同期で1行ずつだと遅いため、バッチ化します
    for (const file of quoteFiles) {
      console.log(`[J-Quants] Processing: ${file.Key}`);
      const getRes = await fetchJQuants(`/v2/bulk/get?key=${file.Key}`);
      
      let batch: any[] = [];
      const BATCH_SIZE = 5000;

      const flushBatch = async () => {
        if (batch.length === 0) return;
        
        // 分割検知用
        const splits = batch.filter(r => r.AdjFactor && parseFloat(r.AdjFactor) !== 1.0 && parseFloat(r.AdjFactor) > 0);
        
        const transaction = batch.map(row => {
          const open = parseFloat(row.O) || null;
          const high = parseFloat(row.H) || null;
          const low = parseFloat(row.L) || null;
          const close = parseFloat(row.C) || null;
          const volume = parseFloat(row.Vo) || 0;
          const turnover = parseFloat(row.Va) || 0;
          return {
            sql: `INSERT OR IGNORE INTO daily_quotes 
                  (ticker, date, open, high, low, close, volume, turnover, adj_open, adj_high, adj_low, adj_close, adj_volume) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [row.Code, row.Date, open, high, low, close, volume, turnover, open, high, low, close, volume]
          };
        });

        // 過去分をUPDATEするクエリもトランザクションに積む
        for (const s of splits) {
          const factor = parseFloat(s.AdjFactor);
          // 日足の調整
          transaction.push({
            sql: `UPDATE daily_quotes SET 
                  adj_open = adj_open * ?, 
                  adj_high = adj_high * ?, 
                  adj_low = adj_low * ?, 
                  adj_close = adj_close * ?, 
                  adj_volume = adj_volume / ? 
                  WHERE ticker = ? AND date < ?`,
            args: [factor, factor, factor, factor, factor, s.Code, s.Date]
          });
          // 財務の調整 (EPS, 1株配当はfactor倍、発行済株式数はfactorで割る)
          transaction.push({
            sql: `UPDATE financials SET 
                  adj_eps = adj_eps * ?, 
                  adj_dividend = adj_dividend * ?, 
                  adj_shares_outstanding = adj_shares_outstanding / ? 
                  WHERE ticker = ? AND date < ?`,
            args: [factor, factor, factor, s.Code, s.Date]
          });
          console.log(`[J-Quants] Stock Split Detected: ${s.Code} on ${s.Date} (Factor: ${factor})`);
        }

        await db.batch(transaction, 'write');
        batch = [];
      };

      await downloadAndProcessCsv(getRes.url, async (row) => {
        batch.push(row);
        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }
      });
      await flushBatch(); // 残りをフラッシュ
    }

    console.log('[J-Quants] Calling metrics calculator...');
    const { calculateAndPopulateStocks } = await import('./calculator');
    const calcResult = await calculateAndPopulateStocks();
    if (!calcResult.success) {
      throw calcResult.error;
    }

    console.log('--- Sync Completed Successfully ---');
    return { success: true, message: 'Data synced successfully' };
  } catch (error: any) {
    console.error('Data Sync Failed:', error);
    return { success: false, error: error.message };
  }
}
