import { RawDailyQuote, calculateTrimmedVolume50d } from './trend_calculator';
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

  // 1. 通常時（ブレイクなし）のベース高値とピボットを仮算出
  const baseWindowEnd = Math.min(quotes.length, 66);
  if (baseWindowEnd > 1) {
    const baseQuotes = quotes.slice(1, baseWindowEnd);
    const baseHigh = Math.max(...baseQuotes.map(q => q.adj_close));
    if (baseHigh > 0) {
      defaultRes.base_high = baseHigh;
      defaultRes.base_depth_pct = ((currentClose - baseHigh) / baseHigh) * 100;

      // 真のピボット価格 (直近1〜20営業日前＝約1ヶ月間の局所高値)
      const pivotWindowEnd = Math.min(quotes.length, 21);
      const pivotQuotes = quotes.slice(1, pivotWindowEnd);
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

  // 2. 直近0〜5営業日前（約1週間）のブレイクアウト遡り探索とピボット価格のロック
  // t=0(当日) 〜 t=5(5営業日前) を走査
  // ※ブレイク日 t に対する局所高値ピボットは、直前日 (t+1) から過去約1ヶ月 (t+25) を遡って算出
  for (let t = 0; t <= Math.min(5, quotes.length - 26); t++) {
    const boDay = quotes[t];
    const tPivotQuotes = quotes.slice(t + 1, Math.min(quotes.length, t + 25));
    const tBaseQuotes = quotes.slice(t + 1, Math.min(quotes.length, t + 66));
    if (tPivotQuotes.length === 0 || tBaseQuotes.length === 0) continue;

    const priorPivot = Math.max(...tPivotQuotes.map(q => q.adj_close));
    const priorBaseHigh = Math.max(...tBaseQuotes.map(q => q.adj_close));
    if (priorPivot <= 0 || priorBaseHigh <= 0) continue;

    // ハンドル健全性（当時のピボットがベース高値の15%以内にあるか）
    const isPriorHandleHealthy = priorPivot >= priorBaseHigh * 0.85;
    if (!isPriorHandleHealthy) continue;

    // 当時のトリム50日平均出来高（配列長ガード付き）
    const boTrimmedVol50 = calculateTrimmedVolume50d(quotes, t);

    // ブレイク条件:
    // 1. 終値が当時のピボットを上抜け (boDay.adj_close > priorPivot)
    // 2. 出来高が当時のトリム50日出来高の基準以上 (当日t=0なら1.5倍、過去数日は1.3倍以上)
    // 3. 上位30%以内の高値引け陽線 (CLV >= 0.70)
    const range = boDay.adj_high - boDay.adj_low;
    const clv = range > 0 ? (boDay.adj_close - boDay.adj_low) / range : 1.0;
    const volMultiple = t === 0 ? 1.5 : 1.3;

    if (
      boDay.adj_close > priorPivot &&
      boDay.adj_volume >= boTrimmedVol50 * volMultiple &&
      clv >= 0.70
    ) {
      // 直近ブレイクアウトを検知！ピボット価格を当時の抵抗線価格にロック
      defaultRes.pivot_price = priorPivot;
      defaultRes.base_high = priorBaseHigh;
      defaultRes.base_depth_pct = ((currentClose - priorBaseHigh) / priorBaseHigh) * 100;
      defaultRes.is_handle_healthy = true;

      const distFromLocked = ((currentClose - priorPivot) / priorPivot) * 100;
      defaultRes.pivot_distance_pct = distFromLocked;

      // オニール・ミネルヴィニ流買いゾーン判定: ピボットから 0.0% 〜 +5.0%
      if (distFromLocked >= 0 && distFromLocked <= 5.0) {
        defaultRes.is_pivot_breakout = true;
      }
      // ブレイク検知時はセットアップ直前（is_near_pivot）は解除
      defaultRes.is_near_pivot = false;
      break; // 直近の成立ブレイクを採用
    }
  }

  // 3. ATR (値幅収縮) の算出
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

  // 4. 出来高枯渇 (Volume Dry-Up: VDU) の算出（トリム50日平均基準・配列長ガード付き）
  const vol5Sum = quotes.slice(0, Math.min(5, quotes.length)).reduce((acc, q) => acc + q.adj_volume, 0);
  const vol5Avg = vol5Sum / Math.min(5, quotes.length);
  const trimmedVol50 = calculateTrimmedVolume50d(quotes, 0);

  // 参考値としての50日単純平均も計算・保持
  const vol50Slice = quotes.slice(0, Math.min(50, quotes.length));
  const vol50Avg = vol50Slice.reduce((acc, q) => acc + q.adj_volume, 0) / (vol50Slice.length || 1);

  defaultRes.volume_5d_avg = vol5Avg;
  defaultRes.volume_50d_avg = vol50Avg;

  if (trimmedVol50 > 0) {
    const dryupRatio = vol5Avg / trimmedVol50;
    defaultRes.volume_dryup_ratio = dryupRatio;
    // トリム50日平均出来高の60%以下に枯渇
    defaultRes.is_volume_dryup = dryupRatio < 0.60;
  }

  return defaultRes;
}

// ミネルヴィニ流プルバック判定は責任分離のため pullback_screener.ts へ移行
export { calculateSepaPullback } from './pullback_screener';
