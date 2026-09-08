import { createClient } from '@libsql/client';
import { calculateSepaTrend, RawDailyQuote } from './trend_calculator';
import { calculateAllRsRatings, TickerQuotesMap } from './rs_calculator';
import { calculateSepaFundamentals } from './quarterly_standalone';
import { RawFinancialRow } from './quarterly_parser';
import { calculateSepaVcp } from './vcp_screener';
import { SepaStockRecord } from '../../features/sepa/types/sepa';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

const NON_OPERATING_PATTERNS = [
  '上場信託',
  'ETF',
  'ETN',
  'ＥＴＮ',
  '投資法人',
  'リート',
  '上場投信',
  'ファンド',
  'ＥＴＦ',
  'ブル',
  'ベア',
];

/**
 * 銘柄が事業会社（個別株）か、投信・ETF・REIT等（非事業会社）かを判定
 */
export function isOperatingCompany(name: string | null | undefined, industry: string | null | undefined): boolean {
  if (!name) return true;
  if (industry === 'ETF等' || industry === 'REIT等' || industry === 'その他') {
    return false;
  }
  for (const pattern of NON_OPERATING_PATTERNS) {
    if (name.includes(pattern)) {
      return false;
    }
  }
  return true;
}

/**
 * sepa_metrics テーブルを初期化
 */
export async function ensureSepaTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sepa_metrics (
      ticker TEXT PRIMARY KEY,
      name TEXT,
      market TEXT,
      industry TEXT,
      is_operating_company INTEGER DEFAULT 1,
      latest_date TEXT,
      current_price REAL,
      sma_50 REAL,
      sma_150 REAL,
      sma_200 REAL,
      is_above_sma_50 INTEGER,
      is_above_sma_150 INTEGER,
      is_above_sma_200 INTEGER,
      is_sma_50_above_150_200 INTEGER,
      is_sma_150_above_200 INTEGER,
      sma_200_slope_22d REAL,
      is_sma200_uptrend_1m INTEGER,
      is_sma200_uptrend_5m INTEGER,
      low_52w REAL,
      distance_from_low_52w_pct REAL,
      high_52w REAL,
      distance_to_high_52w_pct REAL,
      is_ipo INTEGER,
      is_trend_template_pass INTEGER,
      passed_conditions_count INTEGER,
      stage2_entry_date TEXT,
      rs_score_raw REAL,
      rs_rating INTEGER,
      is_pseudo_rs INTEGER,
      sales_yoy_pct REAL,
      op_yoy_pct REAL,
      ordinary_profit_yoy_pct REAL,
      eps_yoy_pct REAL,
      growth_status TEXT,
      is_growth_accelerating INTEGER,
      is_margin_expanding INTEGER,
      has_3y_annual_growth INTEGER,
      has_accounting_noise_risk INTEGER,
      standalone_sales REAL,
      standalone_op REAL,
      standalone_profit REAL,
      standalone_eps REAL,
      roe REAL,
      market_cap REAL,
      avg_trading_value_5d REAL,
      base_high REAL,
      base_depth_pct REAL,
      pivot_price REAL,
      pivot_distance_pct REAL,
      is_near_pivot INTEGER,
      is_pivot_breakout INTEGER,
      is_handle_healthy INTEGER,
      atr_10 REAL,
      atr_50 REAL,
      atr_contraction_ratio REAL,
      is_volatility_contracted INTEGER,
      volume_5d_avg REAL,
      volume_50d_avg REAL,
      volume_dryup_ratio REAL,
      is_volume_dryup INTEGER,
      ir_catalyst_count INTEGER,
      latest_ir_title TEXT,
      latest_ir_date TEXT
    )
  `);

  // 既存テーブルへのマイグレーション安全策（カラム存在チェックとALTER TABLE）
  try {
    const tableInfo = await db.execute(`PRAGMA table_info(sepa_metrics)`);
    if (tableInfo.rows && tableInfo.rows.length > 0) {
      const hasCol = tableInfo.rows.some(r => r.name === 'is_operating_company');
      if (!hasCol) {
        await db.execute(`ALTER TABLE sepa_metrics ADD COLUMN is_operating_company INTEGER DEFAULT 1`);
      }
    }
  } catch (e) {
    console.warn('[SEPA] Migration check warning:', e);
  }

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sepa_operating ON sepa_metrics (is_operating_company)`);
}

/**
 * 全銘柄のSEPA指標を一括計算し、sepa_metrics テーブルを再生成・キャッシュ
 */
export async function calculateAndPopulateSepa(onProgress?: (msg: string) => void) {
  console.log('--- Starting Minervini SEPA Metrics Calculation ---');
  if (onProgress) onProgress('SEPA指標の初期化中...');
  await db.execute(`DROP TABLE IF EXISTS sepa_metrics`);
  await ensureSepaTable();
  await db.execute('DELETE FROM sepa_metrics');

  // 1. 全銘柄のマスタ・株価指標 (stocks) を取得
  const stocksRes = await db.execute(`
    SELECT ticker, name, market, industry, market_cap, avg_trading_value_5d, roe
    FROM stocks
  `);
  const stockMap = new Map<string, any>();
  stocksRes.rows.forEach(r => stockMap.set(r.ticker as string, r));

  // 2. 日足データのロード (過去300日分)
  if (onProgress) onProgress('日足時系列データをロード中...');
  console.log('[SEPA] Loading daily quotes...');
  const quotesRes = await db.execute(`
    SELECT ticker, date, adj_open, adj_high, adj_low, adj_close, adj_volume
    FROM daily_quotes
    ORDER BY ticker, date DESC
  `);

  // 市場全体の最新営業日を取得し、10日間の猶予基準日（cutoffDate）を算出
  let latestMarketDateStr = '';
  for (const r of quotesRes.rows) {
    const d = r.date as string;
    if (!latestMarketDateStr || d > latestMarketDateStr) {
      latestMarketDateStr = d;
    }
  }

  let cutoffDateStr = '';
  if (latestMarketDateStr) {
    const marketDate = new Date(latestMarketDateStr);
    marketDate.setDate(marketDate.getDate() - 10);
    cutoffDateStr = marketDate.toISOString().slice(0, 10);
  }
  console.log(`[SEPA] Market latest date: ${latestMarketDateStr}, Delisted cutoff (10-day grace): ${cutoffDateStr}`);

  const quotesMap = new Map<string, RawDailyQuote[]>();
  quotesRes.rows.forEach(r => {
    const t = r.ticker as string;
    if (!quotesMap.has(t)) quotesMap.set(t, []);
    const arr = quotesMap.get(t)!;
    if (arr.length < 320) {
      arr.push({
        date: r.date as string,
        adj_open: Number(r.adj_open),
        adj_high: Number(r.adj_high),
        adj_low: Number(r.adj_low),
        adj_close: Number(r.adj_close),
        adj_volume: Number(r.adj_volume),
      });
    }
  });

  // 3. 全銘柄のRSレーティング一括計算 (上場廃止・売買停止株は除外して正規化)
  if (onProgress) onProgress('日本株RSレーティングを全数正規化中...');
  console.log('[SEPA] Calculating RS Ratings...');
  const tickerQuotesList: TickerQuotesMap[] = [];
  quotesMap.forEach((quotes, ticker) => {
    if (quotes.length > 0 && (!cutoffDateStr || quotes[0].date >= cutoffDateStr)) {
      tickerQuotesList.push({ ticker, quotes });
    }
  });
  const rsMap = calculateAllRsRatings(tickerQuotesList);

  // 4. 財務データのロード
  if (onProgress) onProgress('四半期単体ファンダメンタルズを解析中...');
  console.log('[SEPA] Loading financials...');
  const finRes = await db.execute(`
    SELECT ticker, date, net_sales, operating_profit, ordinary_profit, profit, eps, adj_eps, adj_shares_outstanding
    FROM financials
    ORDER BY ticker, date DESC
  `);
  const finMap = new Map<string, RawFinancialRow[]>();
  finRes.rows.forEach(r => {
    const t = r.ticker as string;
    if (!finMap.has(t)) finMap.set(t, []);
    finMap.get(t)!.push({
      ticker: t,
      date: r.date as string,
      net_sales: r.net_sales != null ? Number(r.net_sales) : null,
      operating_profit: r.operating_profit != null ? Number(r.operating_profit) : null,
      ordinary_profit: r.ordinary_profit != null ? Number(r.ordinary_profit) : null,
      profit: r.profit != null ? Number(r.profit) : null,
      eps: r.eps != null ? Number(r.eps) : null,
      adj_eps: r.adj_eps != null ? Number(r.adj_eps) : null,
      adj_shares_outstanding: r.adj_shares_outstanding != null ? Number(r.adj_shares_outstanding) : null,
    });
  });

  // 5. 新規事業IRニュース (カタリスト) の件数マッピング
  const irRes = await db.execute(`
    SELECT ticker, COUNT(*) as cnt, MAX(title) as latest_title, MAX(date) as latest_date
    FROM ir_news
    GROUP BY ticker
  `);
  const irMap = new Map<string, { cnt: number; title: string; date: string }>();
  irRes.rows.forEach(r => {
    irMap.set(r.ticker as string, {
      cnt: Number(r.cnt),
      title: r.latest_title as string,
      date: r.latest_date as string,
    });
  });

  // 6. 各銘柄のSEPAレコード生成とバルクインサート
  if (onProgress) onProgress('SEPA指標テーブルを構築中...');
  console.log('[SEPA] Populating sepa_metrics table...');
  const batch: any[] = [];
  const BATCH_SIZE = 1000;

  for (const [ticker, s] of stockMap.entries()) {
    const quotes = quotesMap.get(ticker) || [];
    if (quotes.length === 0) continue;

    // 上場廃止・売買停止銘柄の除外 (最新取引日が市場最新営業日の10日前の猶予基準日より古い場合は除外)
    if (cutoffDateStr && quotes[0].date < cutoffDateStr) {
      continue;
    }

    const trend = calculateSepaTrend(quotes);
    const rs = rsMap.get(ticker) || { rs_score_raw: null, rs_rating: null, is_pseudo_rs: false };
    const finRows = finMap.get(ticker) || [];
    const fund = calculateSepaFundamentals(
      finRows,
      s.market_cap != null ? Number(s.market_cap) : null,
      s.avg_trading_value_5d != null ? Number(s.avg_trading_value_5d) : null,
      s.roe != null ? Number(s.roe) : null
    );
    const vcp = calculateSepaVcp(quotes);
    const ir = irMap.get(ticker);

    // RS70以上判定をトレンドテンプレート合致数に反映
    if (rs.rs_rating != null && rs.rs_rating >= 70) {
      trend.passed_conditions_count = Math.min(8, trend.passed_conditions_count + 1);
    }

    const isOp = isOperatingCompany(s.name, s.industry);

    batch.push({
      sql: `INSERT INTO sepa_metrics VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?
      )`,
      args: [
        ticker, s.name, s.market, s.industry, isOp ? 1 : 0, quotes[0].date,
        trend.current_price, trend.sma_50, trend.sma_150, trend.sma_200,
        trend.is_above_sma_50 ? 1 : 0, trend.is_above_sma_150 ? 1 : 0, trend.is_above_sma_200 ? 1 : 0,
        trend.is_sma_50_above_150_200 ? 1 : 0, trend.is_sma_150_above_200 ? 1 : 0,
        trend.sma_200_slope_22d, trend.is_sma200_uptrend_1m ? 1 : 0, trend.is_sma200_uptrend_5m ? 1 : 0,
        trend.low_52w, trend.distance_from_low_52w_pct, trend.high_52w, trend.distance_to_high_52w_pct,
        trend.is_ipo ? 1 : 0, trend.is_trend_template_pass ? 1 : 0, trend.passed_conditions_count, trend.stage2_entry_date,
        rs.rs_score_raw, rs.rs_rating, rs.is_pseudo_rs ? 1 : 0,
        fund.sales_yoy_pct, fund.op_yoy_pct, fund.ordinary_profit_yoy_pct, fund.eps_yoy_pct,
        fund.growth_status, fund.is_growth_accelerating ? 1 : 0, fund.is_margin_expanding ? 1 : 0,
        fund.has_3y_annual_growth ? 1 : 0, fund.has_accounting_noise_risk ? 1 : 0,
        fund.standalone_sales, fund.standalone_op, fund.standalone_profit, fund.standalone_eps,
        fund.roe, fund.market_cap, fund.avg_trading_value_5d,
        vcp.base_high, vcp.base_depth_pct,
        vcp.pivot_price, vcp.pivot_distance_pct, vcp.is_near_pivot ? 1 : 0, vcp.is_pivot_breakout ? 1 : 0, vcp.is_handle_healthy ? 1 : 0,
        vcp.atr_10, vcp.atr_50, vcp.atr_contraction_ratio, vcp.is_volatility_contracted ? 1 : 0,
        vcp.volume_5d_avg, vcp.volume_50d_avg, vcp.volume_dryup_ratio, vcp.is_volume_dryup ? 1 : 0,
        ir?.cnt || 0, ir?.title || null, ir?.date || null
      ]
    });

    if (batch.length >= BATCH_SIZE) {
      await db.batch(batch, 'write');
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    await db.batch(batch, 'write');
  }

  console.log('[SEPA] Calculation Complete. Successfully populated sepa_metrics.');
  return { success: true };
}
