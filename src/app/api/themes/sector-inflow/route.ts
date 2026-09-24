import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GICS_DICTIONARY } from '@/data/gics_dictionary';
import {
  calculateSectorInflow,
  RawStockDailyQuote,
  RawStockMetricData,
} from '@/features/themes/sector_inflow_calculator';
import {
  calculateSectorEarlyRadar,
  SectorEarlyRadarInput,
} from '@/features/themes/sector_early_radar_calculator';
import {
  CategoryLevel,
  InflowPeriod,
  SectorInflowApiResponse,
  getSectorStageBadge,
} from '@/features/themes/sector_inflow_types';

// インメモリ簡易キャッシュ (60秒TTL)
let cachedData: {
  timestamp: number;
  period: InflowPeriod;
  categoryLevel: CategoryLevel;
  response: SectorInflowApiResponse;
} | null = null;

const CACHE_TTL_MS = 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodParam = Number(searchParams.get('period') || 20);
    const period: InflowPeriod = periodParam === 5 || periodParam === 60 ? periodParam : 20;

    const levelParam = searchParams.get('level');
    const categoryLevel: CategoryLevel = levelParam === 'industry_group' ? 'industry_group' : 'industry';

    const now = Date.now();
    if (
      cachedData &&
      cachedData.period === period &&
      cachedData.categoryLevel === categoryLevel &&
      now - cachedData.timestamp < CACHE_TTL_MS
    ) {
      return NextResponse.json(cachedData.response);
    }

    // 1. 対象銘柄のマスターおよびSEPAメトリクス取得 (Audit OK および ERROR 含む全分類済み銘柄、ETF/REIT等を除く)
    const stocksSql = `
      SELECT 
        s.ticker, 
        s.name, 
        COALESCE(sm.market_cap, s.market_cap, 0) as market_cap,
        COALESCE(m.gics_sub_industry_id, sm.gics_sub_industry_id) as gics_sub_id,
        sm.rs_rating,
        sm.sma_25,
        sm.ema_21,
        sm.sma_50,
        sm.volume_50d_avg,
        sm.is_pullback_21_ema,
        sm.is_pullback_50,
        sm.is_pivot_breakout
      FROM equities_master m
      JOIN stocks s ON m.ticker = s.ticker
      LEFT JOIN sepa_metrics sm ON s.ticker = sm.ticker
      WHERE m.gics_sub_industry_id IS NOT NULL
        AND m.gics_sub_industry_id NOT LIKE '98%'
        AND m.gics_sub_industry_id NOT LIKE '99%'
        AND (m.theme IS NULL OR m.theme NOT IN ('株式以外', 'TPM'))
    `;
    const stocksRes = await db.execute(stocksSql);

    // 2. 日足取得範囲の決定 (60日モードなら過去120日必要、5/20日モードなら過去60日必要)
    const pastWindowDays = period === 60 ? 120 : 60;
    const requiredTotalDays = period + pastWindowDays + 10;

    const dateRow = await db.execute('SELECT MAX(date) as max_date FROM daily_quotes');
    const maxDate = String(dateRow.rows[0]?.max_date || '');

    const datesRes = await db.execute({
      sql: 'SELECT DISTINCT date FROM daily_quotes ORDER BY date DESC LIMIT ?',
      args: [requiredTotalDays],
    });
    const dateList = datesRes.rows.map((r) => String(r.date)).reverse();
    const minDate = dateList[0] || maxDate;

    // 3. quotes一括取得
    const quotesRes = await db.execute({
      sql: `
        SELECT ticker, date, open, high, low, close, volume, turnover
        FROM daily_quotes
        WHERE date >= ?
        ORDER BY ticker, date ASC
      `,
      args: [minDate],
    });

    const quotesByTicker = new Map<string, RawStockDailyQuote[]>();
    for (const row of quotesRes.rows) {
      const t = String(row.ticker);
      const list = quotesByTicker.get(t) || [];
      list.push({
        date: String(row.date),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
        turnover: Number(row.turnover || Number(row.volume) * Number(row.close)),
      });
      quotesByTicker.set(t, list);
    }

    // 4. RawStockMetricData 構築
    const stocksData: RawStockMetricData[] = [];

    for (const row of stocksRes.rows) {
      const ticker = String(row.ticker);
      const subId = String(row.gics_sub_id);
      const gicsInfo = GICS_DICTIONARY[subId];
      if (!gicsInfo) continue;

      const quotes = quotesByTicker.get(ticker) || [];
      if (quotes.length < period + 1) continue;

      const qLen = quotes.length;
      const latest = quotes[qLen - 1];
      const prev = quotes[qLen - 2];

      const isPullback21 = Number(row.is_pullback_21_ema) === 1;
      const isPullback50 = Number(row.is_pullback_50) === 1;
      const isPullback = isPullback21 || isPullback50;
      const isBounceTriggered = isPullback && latest.close > latest.open && latest.close > prev.high;

      const isBreakoutRecent = Number(row.is_pivot_breakout) === 1;

      let pullbackType: 'NONE' | 'PULLBACK_21EMA' | 'PULLBACK_50MA' = 'NONE';
      if (isPullback21) pullbackType = 'PULLBACK_21EMA';
      else if (isPullback50) pullbackType = 'PULLBACK_50MA';

      stocksData.push({
        code: ticker,
        name: String(row.name),
        marketCap: Number(row.market_cap || 0),
        gicsIndustryId: gicsInfo.industry_id,
        gicsIndustryName: gicsInfo.industry_name,
        gicsIndustryGroupId: gicsInfo.industry_group_id,
        gicsIndustryGroupName: gicsInfo.industry_group_name,
        gicsSectorId: gicsInfo.sector_id,
        gicsSectorName: gicsInfo.sector_name,
        quotes,
        sma25: row.sma_25 != null ? Number(row.sma_25) : null,
        sma50: row.sma_50 != null ? Number(row.sma_50) : null,
        sma50Volume: row.volume_50d_avg != null ? Number(row.volume_50d_avg) : null,
        rsRank: row.rs_rating != null ? Number(row.rs_rating) : 50,
        rsRankPast: null,
        isBreakoutRecent,
        pullbackType,
        isBounceTriggered,
      });
    }

    // 5. 計算エンジン実行 (トレンド確認)
    const sectors = calculateSectorInflow({
      period,
      stocksData,
      categoryLevel,
    });

    // 6. 市場売買代金コンテキスト算出
    let totalMarketTurnoverToday = 0;
    let totalMarketTurnoverPast20 = 0;
    for (const s of stocksData) {
      const qLen = s.quotes.length;
      if (qLen >= 1) {
        totalMarketTurnoverToday += s.quotes[qLen - 1].turnover;
        const p20Start = Math.max(0, qLen - 21);
        for (let k = p20Start; k < qLen - 1; k++) {
          totalMarketTurnoverPast20 += s.quotes[k].turnover;
        }
      }
    }
    const avgMarketTurnoverPast20 = totalMarketTurnoverPast20 / 20;

    // 7. 先行初動レーダー計算 (母集団は sectors と 100% 完全同一)
    const earlyInputs: SectorEarlyRadarInput[] = sectors.map(sec => {
      const matchedStocks = stocksData.filter(stk => {
        if (categoryLevel === 'industry_group') {
          return stk.gicsIndustryGroupId === sec.industryId;
        }
        return stk.gicsIndustryId === sec.industryId;
      });
      return {
        industryId: sec.industryId,
        industryName: sec.industryName,
        stocks: matchedStocks,
      };
    });

    const earlyRadarMap = calculateSectorEarlyRadar(earlyInputs, {
      totalMarketTurnoverToday,
      avgMarketTurnoverPast20,
    });

    // 8. トレンド Q1 / 初動 Q1 の判定および 3段階進行ステータス付与
    const q1Threshold = Math.floor(sectors.length / 5);
    sectors.forEach((sec, idx) => {
      const isTrendQ1 = idx < q1Threshold;
      const earlyMetrics = earlyRadarMap.get(sec.industryId) || {
        stealthIndex: 0,
        ignitionRatio: 0,
        decouplingRatio: 0,
        leaderActionRatio: 0,
        earlyScore: 0,
        earlyRank: 0,
        isQ1: false,
      };
      sec.trendScore = sec.finalScore;
      sec.trendRank = idx + 1;
      sec.earlyRadar = earlyMetrics;
      sec.stageStatus = getSectorStageBadge(earlyMetrics.isQ1, isTrendQ1);
    });

    const response: SectorInflowApiResponse = {
      asOfDate: maxDate,
      period,
      categoryLevel,
      totalMarketTurnover: totalMarketTurnoverToday,
      totalSectorsCount: sectors.length,
      sectors,
    };

    // キャッシュ保存
    cachedData = {
      timestamp: now,
      period,
      categoryLevel,
      response,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Failed to calculate sector inflow:', error);
    return NextResponse.json(
      { error: 'Failed to calculate sector inflow', details: error?.message },
      { status: 500 }
    );
  }
}
