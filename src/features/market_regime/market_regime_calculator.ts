import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export type RegimeStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface MarketRegimeData {
  status: RegimeStatus;
  statusLabel: string;
  actionGuide: string;
  date: string;
  metrics: {
    topixClose: number;
    topixSma50: number;
    topixDistPct: number;
    isTopixAbove50: boolean;
    nikkeiClose: number;
    nikkeiSma50: number;
    nikkeiDistPct: number;
    isNikkeiAbove50: boolean;
    ratio50: number;
    ratio200: number;
    ratioStage2: number;
    distDays20: number;
    drop5d: number;
  };
  checklist: {
    bothAbove50: { pass: boolean; label: string; current: string };
    ratio50Healthy: { pass: boolean; label: string; current: string };
    ratio200Healthy: { pass: boolean; label: string; current: string };
    stage2Healthy: { pass: boolean; label: string; current: string };
    distDaysLow: { pass: boolean; label: string; current: string };
  };
  redTriggers: {
    ratio50Collapsed: { triggered: boolean; label: string };
    bothBelow50: { triggered: boolean; label: string };
    distDaysSevere: { triggered: boolean; label: string };
    breadthRapidDrop: { triggered: boolean; label: string };
  };
}

/**
 * 最新の市場地合い（Market Regime）を判定・算出
 */
export async function calculateMarketRegime(): Promise<MarketRegimeData> {
  // 1. 指数ETF (TOPIX: 13060, 日経225: 13210) の直近60営業日取得
  const [topixRes, nikkeiRes] = await Promise.all([
    db.execute("SELECT date, adj_close as close, adj_volume as volume FROM daily_quotes WHERE ticker = '13060' ORDER BY date DESC LIMIT 60"),
    db.execute("SELECT date, adj_close as close, adj_volume as volume FROM daily_quotes WHERE ticker = '13210' ORDER BY date DESC LIMIT 60"),
  ]);

  if (topixRes.rows.length < 50 || nikkeiRes.rows.length < 50) {
    throw new Error('Insufficient index quotes data for Market Regime calculation.');
  }

  const latestDate = topixRes.rows[0].date as string;

  // TOPIX 指標
  const tClose = topixRes.rows[0].close as number;
  const t50 = (topixRes.rows.slice(0, 50).reduce((acc, r) => acc + (r.close as number), 0)) / 50;
  const isTopixAbove50 = tClose > t50;
  const topixDistPct = ((tClose - t50) / t50) * 100;

  // 日経225 指標
  const nClose = nikkeiRes.rows[0].close as number;
  const n50 = (nikkeiRes.rows.slice(0, 50).reduce((acc, r) => acc + (r.close as number), 0)) / 50;
  const isNikkeiAbove50 = nClose > n50;
  const nikkeiDistPct = ((nClose - n50) / n50) * 100;

  // 出来高20日平均
  const tVol20 = (topixRes.rows.slice(0, 20).reduce((acc, r) => acc + (r.volume as number), 0)) / 20;

  // ディストリビューション日判定 (過去20営業日)
  let distDays20 = 0;
  for (let i = 0; i < 20; i++) {
    const curr = topixRes.rows[i];
    const prev = topixRes.rows[i + 1];
    if (!curr || !prev) break;
    const dropPct = (((curr.close as number) - (prev.close as number)) / (prev.close as number)) * 100;
    if (dropPct <= -0.2 && (curr.volume as number) > (prev.volume as number) && (curr.volume as number) >= tVol20 * 0.9) {
      distDays20++;
    }
  }

  // 2. 市場ブレッドス（sepa_metrics の事前計算結果から取得）
  const [totalRes, above50Res, above200Res, stage2Res] = await Promise.all([
    db.execute('SELECT COUNT(*) as c FROM sepa_metrics WHERE is_operating_company = 1'),
    db.execute('SELECT COUNT(*) as c FROM sepa_metrics WHERE is_operating_company = 1 AND is_above_sma_50 = 1'),
    db.execute('SELECT COUNT(*) as c FROM sepa_metrics WHERE is_operating_company = 1 AND is_above_sma_200 = 1'),
    db.execute('SELECT COUNT(*) as c FROM sepa_metrics WHERE is_operating_company = 1 AND is_trend_template_pass = 1'),
  ]);

  const totalStocks = (totalRes.rows[0].c as number) || 1;
  const ratio50 = ((above50Res.rows[0].c as number) / totalStocks) * 100;
  const ratio200 = ((above200Res.rows[0].c as number) / totalStocks) * 100;
  const ratioStage2 = ((stage2Res.rows[0].c as number) / totalStocks) * 100;

  // 直近5日前の50MA比率との差分 (急落検知)
  const pastQuotesRes = await db.execute(`
    SELECT DISTINCT date FROM daily_quotes 
    WHERE ticker = '13060' AND date <= '${latestDate}' 
    ORDER BY date DESC LIMIT 6
  `);
  let drop5d = 0;
  if (pastQuotesRes.rows.length >= 6) {
    const date5dAgo = pastQuotesRes.rows[5].date as string;
    const past50Res = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN q.adj_close > m.sma_50 THEN 1 ELSE 0 END) as above50
      FROM daily_quotes q
      JOIN sepa_metrics m ON q.ticker = m.ticker
      WHERE q.date = '${date5dAgo}' AND m.is_operating_company = 1 AND m.sma_50 IS NOT NULL
    `);
    if (past50Res.rows.length > 0 && (past50Res.rows[0].total as number) > 1000) {
      const pastRatio50 = ((past50Res.rows[0].above50 as number) / (past50Res.rows[0].total as number)) * 100;
      drop5d = pastRatio50 - ratio50;
    }
  }

  // 3. 判定ロジック
  // 🔴 不良条件 (単一OR)
  const condRed1 = ratio50 < 40.0;
  const condRed2 = !isTopixAbove50 && !isNikkeiAbove50;
  const condRed3 = distDays20 >= 6;
  const condRed4 = ratio50 < 50.0 && drop5d >= 8.0;
  const isRed = condRed1 || condRed2 || condRed3 || condRed4;

  // 🟢 良好条件 (全AND)
  const isBothAbove50 = isTopixAbove50 && isNikkeiAbove50;
  const condGreen1 = isBothAbove50;
  const condGreen2 = ratio50 >= 60.0;
  const condGreen3 = ratio200 >= 50.0;
  const condGreen4 = ratioStage2 >= 20.0;
  const condGreen5 = distDays20 <= 4;
  const isGreen = !isRed && condGreen1 && condGreen2 && condGreen3 && condGreen4 && condGreen5;

  const status: RegimeStatus = isRed ? 'RED' : isGreen ? 'GREEN' : 'YELLOW';

  const statusLabel = status === 'GREEN' ? '地合い良好' : status === 'RED' ? '下落警戒' : '調整警戒';
  const actionGuide =
    status === 'GREEN'
      ? '通常ロットでのブレイク・21EMA反発エントリー推奨。'
      : status === 'RED'
      ? '新規買い原則停止・現金比率の最大化。保有株のストップ厳守。'
      : '新規買いは縮小（ロット半減）。高業績・押し目反発銘柄に厳選。';

  return {
    status,
    statusLabel,
    actionGuide,
    date: latestDate,
    metrics: {
      topixClose: tClose,
      topixSma50: Math.round(t50 * 10) / 10,
      topixDistPct: Math.round(topixDistPct * 10) / 10,
      isTopixAbove50,
      nikkeiClose: nClose,
      nikkeiSma50: Math.round(n50),
      nikkeiDistPct: Math.round(nikkeiDistPct * 10) / 10,
      isNikkeiAbove50,
      ratio50: Math.round(ratio50 * 10) / 10,
      ratio200: Math.round(ratio200 * 10) / 10,
      ratioStage2: Math.round(ratioStage2 * 10) / 10,
      distDays20,
      drop5d: Math.round(drop5d * 10) / 10,
    },
    checklist: {
      bothAbove50: {
        pass: isBothAbove50,
        label: 'TOPIX・日経225ともに50MA上',
        current: `TOPIX: ${topixDistPct >= 0 ? '+' : ''}${topixDistPct.toFixed(1)}% / 日経: ${nikkeiDistPct >= 0 ? '+' : ''}${nikkeiDistPct.toFixed(1)}%`,
      },
      ratio50Healthy: {
        pass: ratio50 >= 60.0,
        label: '50MA上銘柄比率 ≥ 60%',
        current: `${ratio50.toFixed(1)}%`,
      },
      ratio200Healthy: {
        pass: ratio200 >= 50.0,
        label: '200MA上銘柄比率 ≥ 50%',
        current: `${ratio200.toFixed(1)}%`,
      },
      stage2Healthy: {
        pass: ratioStage2 >= 20.0,
        label: 'Stage 2銘柄比率 ≥ 20%',
        current: `${ratioStage2.toFixed(1)}%`,
      },
      distDaysLow: {
        pass: distDays20 <= 4,
        label: '大商い下落日 ≤ 4日 (過去20日)',
        current: `${distDays20}日`,
      },
    },
    redTriggers: {
      ratio50Collapsed: { triggered: condRed1, label: '50MA上銘柄比率 < 40%' },
      bothBelow50: { triggered: condRed2, label: '両指数ともに50MA下回る' },
      distDaysSevere: { triggered: condRed3, label: '大商い下落日 ≥ 6日' },
      breadthRapidDrop: { triggered: condRed4, label: 'ブレッドス急悪化 (50MA<50%かつ5日急落≥8%pt)' },
    },
  };
}
