/**
 * GICSセクター先行初動レーダー 計算エンジン
 * 4大兆候指標（ステルス集積指数・出来高点火率・市場逆行耐性・先導株先行アクション）の集計およびパーセンタイル統合
 */

import { EarlyRadarMetrics } from './sector_inflow_types';
import { RawStockMetricData, RawStockDailyQuote } from './sector_inflow_calculator';
import { calculateTrimmedVolume50d } from '@/lib/sepa/trend_calculator';

export interface SectorEarlyRadarInput {
  industryId: string;
  industryName: string;
  stocks: RawStockMetricData[];
}

export interface EarlyRadarMarketContext {
  totalMarketTurnoverToday: number;
  avgMarketTurnoverPast20: number;
}

/**
 * 同値タイに対応したパーセンタイルランク算出 (0.0〜100.0)
 */
function computePercentileRanks(values: number[], higherIsBetter: boolean = true): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [100.0];
  const indexed = values.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => (higherIsBetter ? a.val - b.val : b.val - a.val));
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && indexed[j + 1].val === indexed[i].val) j++;
    const avgRankIdx = (i + j) / 2;
    const percentile = (avgRankIdx / (n - 1)) * 100.0;
    for (let k = i; k <= j; k++) ranks[indexed[k].idx] = percentile;
    i = j + 1;
  }
  return ranks;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 先行初動レーダー 4大指標および合成スコアを計算
 */
export function calculateSectorEarlyRadar(
  sectors: SectorEarlyRadarInput[],
  marketContext: EarlyRadarMarketContext
): Map<string, EarlyRadarMetrics> {
  interface RawEarlyMetrics {
    industryId: string;
    stealth: number;
    ignition: number;
    decoupling: number;
    leader: number;
  }

  const rawList: RawEarlyMetrics[] = [];

  for (const sector of sectors) {
    const sList = sector.stocks;
    let secTurnoverToday = 0;
    let secTurnoverPast20 = 0;
    const stockStealthList: number[] = [];
    let ignitionCount = 0;
    let decouplingCount = 0;
    let validStockCount = 0;

    for (const s of sList) {
      const qLen = s.quotes.length;
      if (qLen < 2) continue;

      const qT = s.quotes[qLen - 1];
      const qPrev = s.quotes[qLen - 2];
      if (!qT || !qPrev || qT.close <= 0 || qPrev.close <= 0) continue;

      validStockCount++;
      secTurnoverToday += qT.turnover;

      // 過去20日売買代金集計
      const p20Start = Math.max(0, qLen - 21);
      for (let k = p20Start; k < qLen - 1; k++) {
        secTurnoverPast20 += s.quotes[k].turnover;
      }

      // ① 個別銘柄のCLV × 価格抑制（PriceSuppression）
      const dayRet = ((qT.close - qPrev.close) / qPrev.close) * 100;
      const hlRange = qT.high - qT.low;
      const clv = hlRange > 0 ? (qT.close - qT.low) / hlRange : 0.5;
      const priceSuppression = 1.0 / (1.0 + Math.pow(Math.abs(dayRet) / 1.5, 2));
      stockStealthList.push(clv * priceSuppression);

      // ② 出来高点火 (直近5日以内最小 <= 0.75*vol50 かつ 当日 >= 1.5*vol50 かつ 陽線)
      if (qLen >= 30) {
        const past50Quotes = s.quotes.slice(Math.max(0, qLen - 51), qLen - 1);
        if (past50Quotes.length >= 20) {
          const vol50 = calculateTrimmedVolume50d(past50Quotes as any, 0);
          const past5Vols = past50Quotes.slice(-5).map(q => q.volume);
          const min5Vol = past5Vols.length > 0 ? Math.min(...past5Vols) : vol50;
          if (min5Vol <= 0.75 * vol50 && qT.volume >= 1.5 * vol50 && qT.close > qT.open) {
            ignitionCount++;
          }
        }
      }

      // ③ 市場逆行耐性 (前日比 >= 0% OR (前日比 >= -1.5% AND CLV >= 0.70))
      if (dayRet >= 0 || (dayRet >= -1.5 && clv >= 0.70)) {
        decouplingCount++;
      }
    }

    if (validStockCount === 0) {
      rawList.push({
        industryId: sector.industryId,
        stealth: 0,
        ignition: 0,
        decoupling: 0,
        leader: 0,
      });
      continue;
    }

    // ① ステルス集積指数 = (当日セクターシェア / 過去20日平均セクターシェア) × Median(個別CLV × 価格抑制)
    const avgSecTurnoverPast20 = secTurnoverPast20 / 20;
    const shareToday = marketContext.totalMarketTurnoverToday > 0 
      ? (secTurnoverToday / marketContext.totalMarketTurnoverToday) * 100 
      : 0;
    const sharePast20 = marketContext.avgMarketTurnoverPast20 > 0 
      ? (avgSecTurnoverPast20 / marketContext.avgMarketTurnoverPast20) * 100 
      : 0;
    const shareMult = sharePast20 > 0 ? (shareToday / sharePast20) : 1.0;
    const stealthIndex = shareMult * computeMedian(stockStealthList);

    // ② 出来高点火率 (%)
    const ignitionRatio = (ignitionCount / validStockCount) * 100;

    // ③ 市場逆行耐性比率 (%)
    const decouplingRatio = (decouplingCount / validStockCount) * 100;

    // ④ 先導株先行アクション比率 (%) (看板株: RS/時価総額上位25%の直近20日最高値 -3%〜+3%)
    const leaderCount = Math.max(1, Math.round(sList.length * 0.25));
    const sortedByRs = [...sList].sort((a, b) => (b.rsRank || 50) - (a.rsRank || 50));
    const leaders = sortedByRs.slice(0, leaderCount);
    let leaderActCount = 0;

    for (const l of leaders) {
      const lqLen = l.quotes.length;
      if (lqLen < 2) continue;
      const lqT = l.quotes[lqLen - 1];
      let baseHigh20d = 0;
      const p20Start = Math.max(0, lqLen - 21);
      for (let k = p20Start; k < lqLen - 1; k++) {
        if (l.quotes[k].high > baseHigh20d) baseHigh20d = l.quotes[k].high;
      }
      if (baseHigh20d > 0 && lqT.close > 0) {
        const dist = ((lqT.close - baseHigh20d) / baseHigh20d) * 100;
        if (dist >= -3.0 && dist <= 3.0) leaderActCount++;
      }
    }
    const leaderActionRatio = (leaderActCount / leaderCount) * 100;

    rawList.push({
      industryId: sector.industryId,
      stealth: stealthIndex,
      ignition: ignitionRatio,
      decoupling: decouplingRatio,
      leader: leaderActionRatio,
    });
  }

  // 4指標のパーセンタイル正規化
  const rStealth = computePercentileRanks(rawList.map(r => r.stealth));
  const rIgnition = computePercentileRanks(rawList.map(r => r.ignition));
  const rDecoupling = computePercentileRanks(rawList.map(r => r.decoupling));
  const rLeader = computePercentileRanks(rawList.map(r => r.leader));

  // 固定加重平均: ステルス 35%, 点火 25%, 逆行耐性 20%, 先導株 20%
  const compositeRaws = rawList.map((_, i) => {
    return 0.35 * rStealth[i] + 0.25 * rIgnition[i] + 0.20 * rDecoupling[i] + 0.20 * rLeader[i];
  });

  // 最終パーセンタイルスコア (0.0〜100.0)
  const finalPercentiles = computePercentileRanks(compositeRaws);

  // 順位付け (スコア降順)
  const ranked = finalPercentiles.map((score, idx) => ({ score, idx }))
    .sort((a, b) => b.score - a.score);

  const resultMap = new Map<string, EarlyRadarMetrics>();
  const q1ThresholdIdx = Math.floor(ranked.length / 5);

  ranked.forEach((item, rankIdx) => {
    const raw = rawList[item.idx];
    const isQ1 = rankIdx < q1ThresholdIdx;
    resultMap.set(raw.industryId, {
      stealthIndex: Number(raw.stealth.toFixed(2)),
      ignitionRatio: Number(raw.ignition.toFixed(1)),
      decouplingRatio: Number(raw.decoupling.toFixed(1)),
      leaderActionRatio: Number(raw.leader.toFixed(1)),
      earlyScore: Math.round(item.score),
      earlyRank: rankIdx + 1,
      isQ1,
    });
  });

  return resultMap;
}
