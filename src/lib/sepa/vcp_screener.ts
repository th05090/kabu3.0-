import { RawDailyQuote } from './trend_calculator';
import { SepaVcpMetrics } from '../../features/sepa/types/sepa';

/**
 * True Range (TR) および ATR を算出
 */
function calculateAtr(quotes: RawDailyQuote[], period: number): number | null {
  if (quotes.length < period + 1) return null;

  let trSum = 0;
  for (let i = 0; i < period; i++) {
    const cur = quotes[i];
    const prev = quotes[i + 1];
    const tr = Math.max(
      cur.adj_high - cur.adj_low,
      Math.abs(cur.adj_high - prev.adj_close),
      Math.abs(cur.adj_low - prev.adj_close)
    );
    trSum += tr;
  }

  return trSum / period;
}

/**
 * VCP（ボラティリティ収縮・出来高枯渇）およびピボット接近・ブレイクを客観判定
 */
export function calculateSepaVcp(quotes: RawDailyQuote[]): SepaVcpMetrics {
  const defaultRes: SepaVcpMetrics = {
    base_high: null,
    base_depth_pct: null,
    pivot_price: null,
    pivot_distance_pct: null,
    is_near_pivot: false,
    is_pivot_breakout: false,
    is_handle_healthy: false,
    atr_10: null,
    atr_50: null,
    atr_contraction_ratio: null,
    is_volatility_contracted: false,
    volume_5d_avg: null,
    volume_50d_avg: null,
    volume_dryup_ratio: null,
    is_volume_dryup: false,
  };

  if (!quotes || quotes.length < 15) return defaultRes;

  const currentClose = quotes[0].adj_close;
  const currentVolume = quotes[0].adj_volume;

  // 1. ベース高値 (Base High: 直近2〜65営業日前の終値最高値)
  const baseWindowEnd = Math.min(quotes.length, 66);
  if (baseWindowEnd > 2) {
    const baseQuotes = quotes.slice(2, baseWindowEnd);
    const baseHigh = Math.max(...baseQuotes.map(q => q.adj_close));
    if (baseHigh > 0) {
      defaultRes.base_high = baseHigh;
      defaultRes.base_depth_pct = ((currentClose - baseHigh) / baseHigh) * 100;

      // 2. 真のピボット価格 (Pivot Price: 直近2〜15営業日前＝約3週間の収縮・ハンドル局所高値)
      const pivotWindowEnd = Math.min(quotes.length, 16);
      const pivotQuotes = quotes.slice(2, pivotWindowEnd);
      const pivotPrice = Math.max(...pivotQuotes.map(q => q.adj_close));

      if (pivotPrice > 0) {
        defaultRes.pivot_price = pivotPrice;
        const distance = ((currentClose - pivotPrice) / pivotPrice) * 100;
        defaultRes.pivot_distance_pct = distance;

        // 健全性ガード: ハンドルがベース上半部 (最高値の15%以内) に位置するか
        const isHealthy = pivotPrice >= baseHigh * 0.85;
        defaultRes.is_handle_healthy = isHealthy;

        // ピボット接近 (セットアップ圏内: -5.0% 〜 0.0% かつ 健全ハンドル)
        defaultRes.is_near_pivot = isHealthy && distance >= -5.0 && distance <= 0.0;
      }
    }
  }

  // 2. ATR (値幅収縮) の算出
  const atr10 = calculateAtr(quotes, 10);
  const atr50 = calculateAtr(quotes, 50);

  defaultRes.atr_10 = atr10;
  defaultRes.atr_50 = atr50;

  if (atr10 != null && atr50 != null && atr50 > 0) {
    const contractionRatio = atr10 / atr50;
    defaultRes.atr_contraction_ratio = contractionRatio;
    // 過去50日平均と比べて値幅が30%以上縮小
    defaultRes.is_volatility_contracted = contractionRatio < 0.70;
  }

  // 3. 出来高枯渇 (Volume Dry-Up: VDU) の算出
  if (quotes.length >= 50) {
    const vol5Sum = quotes.slice(0, 5).reduce((acc, q) => acc + q.adj_volume, 0);
    const vol50Sum = quotes.slice(0, 50).reduce((acc, q) => acc + q.adj_volume, 0);

    const vol5Avg = vol5Sum / 5;
    const vol50Avg = vol50Sum / 50;

    defaultRes.volume_5d_avg = vol5Avg;
    defaultRes.volume_50d_avg = vol50Avg;

    if (vol50Avg > 0) {
      const dryupRatio = vol5Avg / vol50Avg;
      defaultRes.volume_dryup_ratio = dryupRatio;
      // 5日平均出来高が50日平均の60%以下に枯渇
      defaultRes.is_volume_dryup = dryupRatio < 0.60;

      // ピボットブレイクアウト判定: 健全ハンドル かつ ピボット直上 (0〜+3%) かつ 当日出来高が50日平均の1.5倍以上
      if (
        defaultRes.is_handle_healthy &&
        defaultRes.pivot_distance_pct != null &&
        defaultRes.pivot_distance_pct >= 0 &&
        defaultRes.pivot_distance_pct <= 3.0 &&
        currentVolume >= vol50Avg * 1.5
      ) {
        defaultRes.is_pivot_breakout = true;
      }
    }
  }

  return defaultRes;
}

// ミネルヴィニ流プルバック判定は責任分離のため pullback_screener.ts へ移行
export { calculateSepaPullback } from './pullback_screener';
