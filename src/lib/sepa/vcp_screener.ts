import { RawDailyQuote } from './trend_calculator';
import { SepaVcpMetrics, SepaPullbackMetrics } from '../../features/sepa/types/sepa';

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

/**
 * ミネルヴィニ流プルバック（25日線・50日線押し目）を客観判定
 */
export function calculateSepaPullback(
  quotes: RawDailyQuote[],
  sma25: number | null,
  sma50: number | null,
  sma200: number | null,
  isTrendStructuralPass: boolean,
  volume50dAvg: number | null,
  volumeDryupRatio: number | null
): SepaPullbackMetrics {
  const defaultRes: SepaPullbackMetrics = {
    swing_high_20d: null,
    pullback_depth_pct: null,
    max_dd_60d: null,
    min_volume_5d: null,
    min_vdu_ratio: null,
    has_distribution_day: false,
    is_pullback_25: false,
    is_pullback_50: false,
  };

  if (!quotes || quotes.length < 25 || !sma25 || !sma50) return defaultRes;

  const currentPrice = quotes[0].adj_close;
  const vol50Avg = volume50dAvg && volume50dAvg > 0 ? volume50dAvg : 1;

  // 1. 直近20営業日のスイング高値 (直近2〜20日前の高値)
  const window20 = quotes.slice(2, Math.min(quotes.length, 21));
  const swingHigh20d = window20.length > 0 ? Math.max(...window20.map(q => q.adj_high)) : currentPrice;
  defaultRes.swing_high_20d = swingHigh20d;

  let pullbackDepthPct = 0;
  if (swingHigh20d > 0) {
    pullbackDepthPct = ((currentPrice - swingHigh20d) / swingHigh20d) * 100;
    defaultRes.pullback_depth_pct = pullbackDepthPct;
  }

  // 2. 過去60営業日以内の最大ドローダウン (最高値から最安値への下落率)
  const window60 = quotes.slice(0, Math.min(quotes.length, 60));
  if (window60.length > 0) {
    const maxHigh60 = Math.max(...window60.map(q => q.adj_high));
    const minLow60 = Math.min(...window60.map(q => q.adj_low));
    if (maxHigh60 > 0) {
      defaultRes.max_dd_60d = ((minLow60 - maxHigh60) / maxHigh60) * 100;
    }
  }

  // 3. 直近5営業日最小出来高 & min_vdu_ratio
  const window5 = quotes.slice(0, Math.min(quotes.length, 5));
  if (window5.length > 0) {
    const minVol5d = Math.min(...window5.map(q => q.adj_volume));
    defaultRes.min_volume_5d = minVol5d;
    defaultRes.min_vdu_ratio = minVol5d / vol50Avg;
  }

  // 4. 直近5営業日以内のディストリビューション日 (下落日 かつ 出来高 >= 1.5 * 50日平均)
  let hasDistribution = false;
  for (let i = 0; i < Math.min(5, quotes.length - 1); i++) {
    const cur = quotes[i];
    const prev = quotes[i + 1];
    const isDown = cur.adj_close < prev.adj_close || cur.adj_close < cur.adj_open;
    if (isDown && cur.adj_volume >= 1.5 * vol50Avg) {
      hasDistribution = true;
      break;
    }
  }
  defaultRes.has_distribution_day = hasDistribution;

  // 5. 200日線崩壊ガード (直近20営業日以内に終値ベースで200日線を -5% 以上下回っていないこと)
  let is200MaBroken = false;
  if (sma200 != null && sma200 > 0) {
    const window20Quotes = quotes.slice(0, Math.min(quotes.length, 20));
    for (const q of window20Quotes) {
      if (q.adj_close < sma200 * 0.95) {
        is200MaBroken = true;
        break;
      }
    }
  }

  // 6. 共通前提条件
  const hasVolumeDryup =
    (volumeDryupRatio != null && volumeDryupRatio <= 0.85) ||
    (defaultRes.min_vdu_ratio != null && defaultRes.min_vdu_ratio <= 0.75);

  const commonPass =
    isTrendStructuralPass &&
    (defaultRes.max_dd_60d == null || defaultRes.max_dd_60d >= -30.0) &&
    !hasDistribution &&
    hasVolumeDryup &&
    !is200MaBroken;

  if (commonPass) {
    // 25日SMAの傾き (5日前の25SMAと比較)
    let isSma25Rising = true;
    if (quotes.length >= 30) {
      const sma25_5dAgo = quotes.slice(5, 30).reduce((a, q) => a + q.adj_close, 0) / 25;
      isSma25Rising = sma25 >= sma25_5dAgo * 0.995;
    }

    const dist25 = ((currentPrice - sma25) / sma25) * 100;
    const highAbove25 = ((swingHigh20d - sma25) / sma25) * 100;

    // 【25日SMA押し目】
    // 1. スイング高値が25SMAより +3.5% 以上高かった (先行する急伸の証明)
    // 2. 高値からの押しが -3.0% 〜 -12.0% (浅い押し)
    // 3. 25日SMA乖離が -1.5% 〜 +3.5%
    // 4. 25日SMAが上向き
    if (
      isSma25Rising &&
      highAbove25 >= 3.5 &&
      pullbackDepthPct <= -3.0 &&
      pullbackDepthPct >= -12.0 &&
      dist25 >= -1.5 &&
      dist25 <= 3.5
    ) {
      defaultRes.is_pullback_25 = true;
    }

    // 【50日SMA押し目】
    // 1. 高値からの押しが -5.0% 〜 -20.0% (本格調整)
    // 2. 50日SMA乖離が -1.5% 〜 +3.5%
    const dist50 = ((currentPrice - sma50) / sma50) * 100;
    if (
      pullbackDepthPct <= -5.0 &&
      pullbackDepthPct >= -20.0 &&
      dist50 >= -1.5 &&
      dist50 <= 3.5
    ) {
      defaultRes.is_pullback_50 = true;
    }
  }

  return defaultRes;
}
