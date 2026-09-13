/**
 * GICSセクター資金流入確認ツール 計算エンジン
 * 3層11指標の集計、パーセンタイル正規化、50:50シェアブレンド、下落時Spreadクランプ、再パーセンタイル化
 */

import {
  CategoryLevel,
  InflowPeriod,
  MIN_STOCKS_HARD_LIMIT,
  SectorInflowSummary,
  SectorStockDetail,
  getSectorStatusBadge,
  resolveStockBadge,
} from './sector_inflow_types';

export interface RawStockDailyQuote {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number; // 売買代金
}

export interface RawStockMetricData {
  code: string;
  name: string;
  marketCap: number;
  gicsIndustryId: string;
  gicsIndustryName: string;
  gicsIndustryGroupId?: string;
  gicsIndustryGroupName?: string;
  gicsSectorId: string;
  gicsSectorName: string;
  quotes: RawStockDailyQuote[]; // 日付昇順ソート済み
  sma25: number | null;
  sma50: number | null;
  sma50Volume: number | null;
  rsRank: number;
  rsRankPast: number | null; // 期間前のRSランク
  isBreakoutRecent: boolean; // 直近5日以内ブレイク
  pullbackType: 'NONE' | 'PULLBACK_25MA' | 'PULLBACK_50MA';
  isBounceTriggered: boolean;
}


/**
 * パーセンタイルランク算出 (0.0〜1.0)
 * 同率タイの場合は平均順位を採用
 */
export function computePercentileRanks(values: number[], higherIsBetter: boolean = true): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [1.0];

  const indexed = values.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => (higherIsBetter ? a.val - b.val : b.val - a.val));

  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && indexed[j + 1].val === indexed[i].val) {
      j++;
    }
    // i から j までの平均インデックス (0-indexed)
    const avgRankIdx = (i + j) / 2;
    // 0.0〜1.0 に正規化
    const percentile = avgRankIdx / (n - 1);
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].idx] = percentile;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * 中央値 (Median) 算出
 */
export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * セクター資金流入集計メイン処理
 */
export function calculateSectorInflow(params: {
  period: InflowPeriod;
  stocksData: RawStockMetricData[];
  categoryLevel?: CategoryLevel;
}): SectorInflowSummary[] {
  const { period, stocksData, categoryLevel = 'industry' } = params;

  // 1. GICS Industry / Industry Group ごとに銘柄をグルーピング (N >= 5 のハードリミット足切り)
  const groupMap = new Map<string, RawStockMetricData[]>();
  for (const stock of stocksData) {
    const groupId = categoryLevel === 'industry_group' ? stock.gicsIndustryGroupId : stock.gicsIndustryId;
    if (!groupId || !stock.quotes || stock.quotes.length < period + 1) continue;
    const list = groupMap.get(groupId) || [];
    list.push(stock);
    groupMap.set(groupId, list);
  }

  // 市場全体の売買代金集計（当期 & 過去比較期間）および市場平均等ウェイト騰落率
  const pastWindowDays = period === 5 ? 20 : period === 20 ? 60 : 120;
  let totalMarketTurnoverNow = 0;
  let totalMarketTurnoverPast = 0;
  let marketTotalEqReturn = 0;
  let marketTotalStockCount = 0;

  for (const stock of stocksData) {
    const qLen = stock.quotes.length;
    if (qLen < pastWindowDays) continue;
    for (let i = qLen - period; i < qLen; i++) {
      totalMarketTurnoverNow += stock.quotes[i].turnover || stock.quotes[i].volume * stock.quotes[i].close;
    }
    for (let i = qLen - pastWindowDays; i < qLen; i++) {
      totalMarketTurnoverPast += stock.quotes[i].turnover || stock.quotes[i].volume * stock.quotes[i].close;
    }

    const latest = stock.quotes[qLen - 1];
    const startQuote = stock.quotes[Math.max(0, qLen - 1 - period)];
    if (startQuote.close > 0) {
      marketTotalEqReturn += ((latest.close - startQuote.close) / startQuote.close) * 100;
      marketTotalStockCount++;
    }
  }
  // 日数で割って1日あたりの平均売買代金に換算
  const avgDailyMarketTurnoverNow = totalMarketTurnoverNow / period;
  const avgDailyMarketTurnoverPast = totalMarketTurnoverPast / pastWindowDays;
  const marketAvgReturn = marketTotalStockCount > 0 ? marketTotalEqReturn / marketTotalStockCount : 0;


  // 2. 有効業種（N >= MIN_STOCKS_HARD_LIMIT）の中間集計
  interface IntermediateSector {
    industryId: string;
    industryName: string;
    sectorId: string;
    sectorName: string;
    stockCount: number;
    stocks: SectorStockDetail[];
    // 指標実測値
    turnoverShareNow: number;
    turnoverSharePast: number;
    turnoverShareDeltaPct: number;
    turnoverShareDeltaPt: number;
    netMfv: number;
    groupAdRatio: number;
    medianClv: number;
    advanceRatio: number;
    equalWeightReturn: number;
    capWeightReturn: number;
    spreadEqVsCap: number;
    volumeSurgeRatio: number;
    newHighRatio: number;
    trendBreadth: number;
    rsDelta: number;
    breakoutRatio: number;
  }

  const validSectors: IntermediateSector[] = [];

  for (const [groupId, sList] of groupMap.entries()) {
    if (sList.length < MIN_STOCKS_HARD_LIMIT) continue; // ハードリミット N >= 5

    const first = sList[0];
    const n = sList.length;

    const indId = categoryLevel === 'industry_group' ? (first.gicsIndustryGroupId || groupId) : (first.gicsIndustryId || groupId);
    const indName = categoryLevel === 'industry_group' ? (first.gicsIndustryGroupName || groupId) : (first.gicsIndustryName || groupId);
    const secId = first.gicsSectorId || '';
    const secName = first.gicsSectorName || '';

    let secTurnoverNow = 0;
    let secTurnoverPast = 0;
    let totalMfvSum = 0;
    let totalTurnoverSum = 0;
    let upVolumeDaysTotal = 0;
    let downVolumeDaysTotal = 0;

    let advanceCount = 0;
    let totalEqReturn = 0;
    let totalCapWeightReturn = 0;
    let totalMarketCap = 0;
    let volumeSurgeCount = 0;
    let newHighCount = 0;
    let trendSyncCount = 0;
    let totalRsDelta = 0;
    let breakoutCount = 0;

    const clvValues: number[] = [];
    const stockDetails: SectorStockDetail[] = [];

    for (const stock of sList) {
      const q = stock.quotes;
      const qLen = q.length;
      const latest = q[qLen - 1];
      const startQuote = q[Math.max(0, qLen - 1 - period)];
      const prevQuote = qLen >= 2 ? q[qLen - 2] : latest;

      // 騰落率
      const returnRate = startQuote.close > 0 ? ((latest.close - startQuote.close) / startQuote.close) * 100 : 0;
      const dailyChangeRate = prevQuote.close > 0 ? ((latest.close - prevQuote.close) / prevQuote.close) * 100 : 0;

      // CLV (当日)
      const dayRange = latest.high - latest.low;
      const clvDaily = dayRange > 0 ? (latest.close - latest.low) / dayRange : 0.5;
      clvValues.push(clvDaily);

      // 出来高サージ倍率
      const surgeRatio = stock.sma50Volume && stock.sma50Volume > 0 ? latest.volume / stock.sma50Volume : 1.0;

      // 個別銘柄バッジ判定
      const stockBadge = resolveStockBadge({
        pullbackType: stock.pullbackType,
        isBounceTriggered: stock.isBounceTriggered,
        isRecentBreakout: stock.isBreakoutRecent,
      });

      stockDetails.push({
        code: stock.code,
        name: stock.name,
        marketCap: stock.marketCap,
        close: latest.close,
        returnRate: Math.round(returnRate * 100) / 100,
        dailyChangeRate: Math.round(dailyChangeRate * 100) / 100,
        volumeSurgeRatio: Math.round(surgeRatio * 100) / 100,
        clv: Math.round(clvDaily * 1000) / 1000,
        rsRank: stock.rsRank,
        pullbackStatus: {
          type: stock.pullbackType,
          isBounceTriggered: stock.isBounceTriggered,
          clv: Math.round(clvDaily * 1000) / 1000,
          badge: stockBadge,
        },
      });

      // セクター集計
      // 売買代金 (期間 & 過去比較)
      for (let i = Math.max(0, qLen - period); i < qLen; i++) {
        secTurnoverNow += q[i].turnover || q[i].volume * q[i].close;
      }
      for (let i = Math.max(0, qLen - pastWindowDays); i < qLen; i++) {
        secTurnoverPast += q[i].turnover || q[i].volume * q[i].close;
      }

      // 規格化 MFV (-1.0〜+1.0 の正規化CLVを使用)
      for (let i = Math.max(0, qLen - period); i < qLen; i++) {
        const bar = q[i];
        const rng = bar.high - bar.low;
        const clvMfv = rng > 0 ? (2 * bar.close - (bar.high + bar.low)) / rng : 0;
        const val = bar.turnover || bar.volume * bar.close;
        totalMfvSum += clvMfv * val;
        totalTurnoverSum += val;
      }

      // グループ A/D レシオ (期間内の出来高増陽線 / 出来高増陰線)
      for (let i = Math.max(1, qLen - period); i < qLen; i++) {
        const cur = q[i];
        const prv = q[i - 1];
        if (cur.volume > prv.volume) {
          if (cur.close > cur.open) upVolumeDaysTotal++;
          else if (cur.close < cur.open) downVolumeDaysTotal++;
        }
      }

      // 内部構造
      if (returnRate > 0) advanceCount++;
      totalEqReturn += returnRate;
      totalCapWeightReturn += returnRate * stock.marketCap;
      totalMarketCap += stock.marketCap;

      if (surgeRatio >= 1.5 && latest.close > latest.open) volumeSurgeCount++;

      // 直近60日新高値
      const lookback60Start = Math.max(0, qLen - 60);
      let maxHigh60 = 0;
      for (let i = lookback60Start; i < qLen; i++) {
        if (q[i].high > maxHigh60) maxHigh60 = q[i].high;
      }
      if (latest.high >= maxHigh60 && maxHigh60 > 0) newHighCount++;

      // トレンド同期 (25MA & 50MA 上回り)
      if (stock.sma25 && stock.sma50 && latest.close > stock.sma25 && latest.close > stock.sma50) {
        trendSyncCount++;
      }

      if (stock.isBreakoutRecent) breakoutCount++;
    }

    // 業種指標の最終算出
    const avgDailySecTurnoverNow = secTurnoverNow / period;
    const avgDailySecTurnoverPast = secTurnoverPast / pastWindowDays;

    const shareNow = avgDailyMarketTurnoverNow > 0 ? (avgDailySecTurnoverNow / avgDailyMarketTurnoverNow) * 100 : 0;
    const sharePast = avgDailyMarketTurnoverPast > 0 ? (avgDailySecTurnoverPast / avgDailyMarketTurnoverPast) * 100 : 0;

    const shareDeltaPct = ((shareNow - sharePast) / Math.max(sharePast, 0.005)) * 100;
    const shareDeltaPt = shareNow - sharePast;

    const netMfv = totalTurnoverSum > 0 ? totalMfvSum / totalTurnoverSum : 0;
    const groupAdRatio = upVolumeDaysTotal / (downVolumeDaysTotal + 1);
    const medianClv = computeMedian(clvValues);

    const advanceRatio = (advanceCount / n) * 100;
    const eqReturn = totalEqReturn / n;
    const capReturn = totalMarketCap > 0 ? totalCapWeightReturn / totalMarketCap : eqReturn;
    const spread = eqReturn - capReturn;
    const surgeRatioPct = (volumeSurgeCount / n) * 100;
    const newHighRatio = (newHighCount / n) * 100;
    const trendBreadth = (trendSyncCount / n) * 100;

    // 超過リターン: セクター等ウェイト騰落率 − 市場全体等ウェイト騰落率
    const avgRsDelta = eqReturn - marketAvgReturn;
    const breakoutRatio = (breakoutCount / n) * 100;


    validSectors.push({
      industryId: indId,
      industryName: indName,
      sectorId: secId,
      sectorName: secName,
      stockCount: n,
      stocks: stockDetails.sort((a, b) => b.returnRate - a.returnRate),
      turnoverShareNow: Math.round(shareNow * 100) / 100,
      turnoverSharePast: Math.round(sharePast * 100) / 100,
      turnoverShareDeltaPct: Math.round(shareDeltaPct * 10) / 10,
      turnoverShareDeltaPt: Math.round(shareDeltaPt * 100) / 100,
      netMfv: Math.round(netMfv * 1000) / 1000,
      groupAdRatio: Math.round(groupAdRatio * 100) / 100,
      medianClv: Math.round(medianClv * 1000) / 1000,
      advanceRatio: Math.round(advanceRatio * 10) / 10,
      equalWeightReturn: Math.round(eqReturn * 100) / 100,
      capWeightReturn: Math.round(capReturn * 100) / 100,
      spreadEqVsCap: Math.round(spread * 100) / 100,
      volumeSurgeRatio: Math.round(surgeRatioPct * 10) / 10,
      newHighRatio: Math.round(newHighRatio * 10) / 10,
      trendBreadth: Math.round(trendBreadth * 10) / 10,
      rsDelta: Math.round(avgRsDelta * 10) / 10,
      breakoutRatio: Math.round(breakoutRatio * 10) / 10,
    });
  }

  const sLen = validSectors.length;
  if (sLen === 0) return [];

  // 3. 各指標のパーセンタイルランク計算
  const rShareDeltaPct = computePercentileRanks(validSectors.map((s) => s.turnoverShareDeltaPct));
  const rShareDeltaPt = computePercentileRanks(validSectors.map((s) => s.turnoverShareDeltaPt));
  const rMfv = computePercentileRanks(validSectors.map((s) => s.netMfv));
  const rAdRatio = computePercentileRanks(validSectors.map((s) => s.groupAdRatio));
  const rMedianClv = computePercentileRanks(validSectors.map((s) => s.medianClv));

  const rAdvance = computePercentileRanks(validSectors.map((s) => s.advanceRatio));
  // 下落相場では Spread 加点を無効化 (equalWeightReturn <= 0 の業種は中立 0.50 にクランプ)
  const rawSpreads = validSectors.map((s) => (s.equalWeightReturn > 0 ? s.spreadEqVsCap : -999999));
  const rSpreadBase = computePercentileRanks(rawSpreads);

  const rSurge = computePercentileRanks(validSectors.map((s) => s.volumeSurgeRatio));
  const rNewHigh = computePercentileRanks(validSectors.map((s) => s.newHighRatio));
  const rTrend = computePercentileRanks(validSectors.map((s) => s.trendBreadth));

  const rRsDelta = computePercentileRanks(validSectors.map((s) => s.rsDelta));
  const rBreakout = computePercentileRanks(validSectors.map((s) => s.breakoutRatio));

  // 4. 生スコア (RawScore) の加重合成
  const rawScores: number[] = new Array(sLen);

  for (let i = 0; i < sLen; i++) {
    const s = validSectors[i];

    // Layer 1: 資金フロー (40%)
    const shareRankBlend = 0.5 * rShareDeltaPct[i] + 0.5 * rShareDeltaPt[i];
    const rankFlow =
      0.35 * shareRankBlend +
      0.35 * rMfv[i] +
      0.20 * rAdRatio[i] +
      0.10 * rMedianClv[i];

    // Layer 2: 内部構造 (35%)
    const spreadRankEvaluated = s.equalWeightReturn > 0 ? rSpreadBase[i] : 0.5; // 下落相場クランプ
    const rankBreadth =
      0.25 * rAdvance[i] +
      0.25 * spreadRankEvaluated +
      0.20 * rSurge[i] +
      0.20 * rNewHigh[i] +
      0.10 * rTrend[i];

    // Layer 3: モメンタム (25%)
    const rankMomentum = 0.6 * rRsDelta[i] + 0.4 * rBreakout[i];

    rawScores[i] = 0.4 * rankFlow + 0.35 * rankBreadth + 0.25 * rankMomentum;
  }

  // 5. 最終スコアの再パーセンタイル化 (0〜100点に美しく均等配分)
  const finalScoreRanks = computePercentileRanks(rawScores);

  // 6. レスポンスオブジェクト構築と完全MECEバッジ付与
  const result: SectorInflowSummary[] = [];

  for (let i = 0; i < sLen; i++) {
    const s = validSectors[i];
    const finalScore = Math.round(finalScoreRanks[i] * 100);
    const badge = getSectorStatusBadge(finalScore, s.equalWeightReturn, s.rsDelta);

    result.push({
      ...s,
      finalScore,
      rawScore: Math.round(rawScores[i] * 1000) / 1000,
      status: badge,
    });
  }

  // 総合スコア降順ソート
  return result.sort((a, b) => b.finalScore - a.finalScore);
}
