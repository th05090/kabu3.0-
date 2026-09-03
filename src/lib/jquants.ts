import { createClient } from '@libsql/client';
import * as zlib from 'zlib';
import { parse } from 'csv-parse';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const BASE_URL = 'https://api.jquants.com';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export async function fetchJQuants(path: string, options: RequestInit = {}) {
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

export async function downloadAndProcessCsv(downloadUrl: string, onRow: (row: any) => Promise<void>) {
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

export async function syncJQuants(onProgress?: (msg: string) => void) {
  console.log('--- J-Quants Data Sync Started ---');
  if (onProgress) onProgress('J-Quants Data Sync Started');

  try {
    // 0. 同期履歴テーブルの作成と取得 (差分同期用)
    await db.execute('CREATE TABLE IF NOT EXISTS sync_history (key TEXT PRIMARY KEY, synced_at TEXT)');
    const historyRes = await db.execute('SELECT key FROM sync_history');
    const syncedKeys = new Set(historyRes.rows.map(r => r.key));
    console.log(`[J-Quants] Found ${syncedKeys.size} previously synced files. Proceeding with incremental sync.`);

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
          sql: `INSERT INTO equities_master (ticker, name, market, industry, last_updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(ticker) DO UPDATE SET name=excluded.name, market=excluded.market, industry=excluded.industry, last_updated=excluded.last_updated`,
          args: [row.Code, row.CoName, row.MktNm, row.S33Nm || row.S17Nm || '', new Date().toISOString()]
        });
      });
    }

    // 2. 財務データの取得 (fins/summary)
    const finsList = await fetchJQuants('/v2/bulk/list?endpoint=fins/summary');
    let finsFiles = (finsList.data || []).filter((f: any) => {
      return f.Key.includes('/2024/') || f.Key.includes('/2025/') || f.Key.includes('/2026/') || f.Key.includes('/live/');
    });
    
    finsFiles = finsFiles.filter((f: any) => !syncedKeys.has(f.Key));
    console.log(`[J-Quants] Found ${finsFiles.length} NEW financials files to process.`);
    if (onProgress && finsFiles.length > 0) onProgress(`新しい財務データ(fins/summary) ${finsFiles.length}件を処理します...`);
    finsFiles.sort((a: any, b: any) => a.Key.localeCompare(b.Key));

    for (const file of finsFiles) {
      console.log(`[J-Quants] Processing Financials: ${file.Key}`);
      if (onProgress) onProgress(`財務データ処理中: ${file.Key}`);
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
                  (ticker, date, net_sales, operating_profit, profit, equity_to_asset_ratio, shares_outstanding, forecast_net_sales, forecast_operating_profit, forecast_profit, forecast_dividend, eps, adj_eps, adj_dividend, adj_shares_outstanding, ordinary_profit, total_assets, equity, operating_cash_flow, investing_cash_flow, financing_cash_flow, cash_and_equivalents) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              row.Code, row.DiscDate, 
              num(row.Sales) || num(row.NCSales), num(row.OP) || num(row.NCOP), num(row.NP) || num(row.NCNP), 
              num(row.EqAR) || num(row.NCEqAR), shares,
              num(row.NxFSales) || num(row.FSales) || num(row.NxFNCSales) || num(row.FNCSales), 
              num(row.NxFOP) || num(row.FOP) || num(row.NxFNCOP) || num(row.FNCOP), 
              num(row.NxFNp) || num(row.FNP) || num(row.NxFNCNP) || num(row.FNCNP), div,
              eps, eps, div, shares,
              num(row.OdP) || num(row.NCOdP) || num(row.OrdinaryProfit) || num(row.NCOrdinaryProfit),
              num(row.TA) || num(row.NCTA) || num(row.TotalAssets) || num(row.NCTotalAssets),
              num(row.Eq) || num(row.NCEq) || num(row.Equity) || num(row.NCEquity),
              num(row.CFO) || num(row.NCOperatingCF) || num(row.OperatingCF),
              num(row.CFI) || num(row.NCInvestingCF) || num(row.InvestingCF),
              num(row.CFF) || num(row.NCFinancingCF) || num(row.FinancingCF),
              num(row.CashEq) || num(row.NCCashEquivalents) || num(row.CashEquivalents)
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
      
      // 同期成功したら履歴に追加
      await db.execute({
        sql: 'INSERT INTO sync_history (key, synced_at) VALUES (?, ?)',
        args: [file.Key, new Date().toISOString()]
      });
    }

    // 3. 日足データの取得 (2024年以降を対象)
    const quotesList = await fetchJQuants('/v2/bulk/list?endpoint=equities/bars/daily');
    let quoteFiles = (quotesList.data || []).filter((f: any) => {
      return f.Key.includes('/2024/') || f.Key.includes('/2025/') || f.Key.includes('/2026/') || f.Key.includes('/live/');
    });
    
    quoteFiles = quoteFiles.filter((f: any) => !syncedKeys.has(f.Key));
    console.log(`[J-Quants] Found ${quoteFiles.length} NEW daily quote files to process.`);
    if (onProgress && quoteFiles.length > 0) onProgress(`新しい日足データ(equities/bars/daily) ${quoteFiles.length}件を処理します...`);
    quoteFiles.sort((a: any, b: any) => a.Key.localeCompare(b.Key));

    // ローカルSQLiteではバルク挿入が早いが、非同期で1行ずつだと遅いため、バッチ化します
    for (const file of quoteFiles) {
      console.log(`[J-Quants] Processing: ${file.Key}`);
      if (onProgress) onProgress(`日足データ処理中: ${file.Key}`);
      const getRes = await fetchJQuants(`/v2/bulk/get?key=${file.Key}`);
      
      let batch: any[] = [];
      const BATCH_SIZE = 5000;

      const flushBatch = async () => {
        if (batch.length === 0) return;
        
        const rawSplits = batch.filter(r => r.AdjFactor && parseFloat(r.AdjFactor) !== 1.0 && parseFloat(r.AdjFactor) > 0);
        
        // 既に適用済みの分割をフィルタリング (冪等性の担保)
        const splits = [];
        for (const s of rawSplits) {
          const res = await db.execute({
            sql: 'SELECT 1 FROM stock_splits WHERE ticker = ? AND date = ?',
            args: [s.Code, s.Date]
          });
          if (res.rows.length === 0) {
            splits.push(s);
          }
        }
        
        const transaction = batch.map(row => {
          const open = parseFloat(row.O) || null;
          const high = parseFloat(row.H) || null;
          const low = parseFloat(row.L) || null;
          const close = parseFloat(row.C) || null;
          const volume = parseFloat(row.Vo) || 0;
          const turnover = parseFloat(row.Va) || 0;
          const adj_open = parseFloat(row.AdjustmentOpen) || open;
          const adj_high = parseFloat(row.AdjustmentHigh) || high;
          const adj_low = parseFloat(row.AdjustmentLow) || low;
          const adj_close = parseFloat(row.AdjustmentClose) || close;
          const adj_volume = parseFloat(row.AdjustmentVolume) || volume;
          
          return {
            sql: `INSERT OR IGNORE INTO daily_quotes 
                  (ticker, date, open, high, low, close, volume, turnover, adj_open, adj_high, adj_low, adj_close, adj_volume) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [row.Code, row.Date, open, high, low, close, volume, turnover, adj_open, adj_high, adj_low, adj_close, adj_volume]
          };
        });

        // 過去分をUPDATEするクエリもトランザクションに積む
        for (const s of splits) {
          const factor = parseFloat(s.AdjFactor);
          // stock_splitsテーブルに記録し、既に記録済みの場合は何もしない
          transaction.push({
            sql: `INSERT INTO stock_splits (ticker, date, factor) VALUES (?, ?, ?)
                  ON CONFLICT DO NOTHING`,
            args: [s.Code, s.Date, factor]
          });
          
          // 日足の調整 (復活)
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
          
          // 財務の調整 (復活)
          transaction.push({
            sql: `UPDATE financials SET 
                  adj_eps = adj_eps * ?, 
                  adj_dividend = adj_dividend * ?, 
                  adj_shares_outstanding = adj_shares_outstanding / ? 
                  WHERE ticker = ? AND date < ?`,
            args: [factor, factor, factor, s.Code, s.Date]
          });
          
          console.log(`[J-Quants] Stock Split Detected & Applied: ${s.Code} on ${s.Date} (Factor: ${factor})`);
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
      
      // 同期成功したら履歴に追加
      await db.execute({
        sql: 'INSERT INTO sync_history (key, synced_at) VALUES (?, ?)',
        args: [file.Key, new Date().toISOString()]
      });
    }

    console.log('[J-Quants] Calling earnings processor for new PDFs...');
    if (onProgress) onProgress('決算PDFからのAI解析(Docling + LLM)を開始します...');
    const { processEarningsReports } = await import('../features/earnings/index');
    await processEarningsReports(onProgress);

    // --- Ollama アンロード処理 ---
    console.log('[Ollama] Unloading models from VRAM before IR News Phase...');
    if (onProgress) onProgress('VRAMを解放中...');
    const modelsToUnload = ["gemma4:12b", "bge-m3"];
    for (const m of modelsToUnload) {
      try {
        await fetch("http://localhost:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: m, keep_alive: 0 })
        });
      } catch(e) {}
    }
    // -----------------------------

    console.log('[J-Quants] Fetching IR News (Global Phase)...');
    if (onProgress) onProgress('過去5日分のIRニュースを検索・取得しています...');
    const { fetchAllIRNewsGlobal } = await import('../scripts/fetch_ir_news');
    await fetchAllIRNewsGlobal(5);

    console.log('[J-Quants] Processing IR News (Individual Phase)...');
    if (onProgress) onProgress('IRニュースのAI解析とベクトル更新を行っています...');
    const { processIrNews } = await import('../scripts/analyze_ir_news');
    await processIrNews(onProgress);

    console.log('[J-Quants] Calling metrics calculator...');
    if (onProgress) onProgress('テクニカル・ファンダメンタル指標を再計算中...');
    const { calculateAndPopulateStocks } = await import('./calculator');
    const calcResult = await calculateAndPopulateStocks();
    if (!calcResult.success) {
      throw calcResult.error;
    }

    console.log('--- Sync Completed Successfully ---');
    if (onProgress) onProgress('同期が完了しました。');
    return { success: true, message: 'Data synced successfully' };
  } catch (error: any) {
    console.error('Data Sync Failed:', error);
    return { success: false, error: error.message };
  }
}
