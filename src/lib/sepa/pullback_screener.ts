import { RawDailyQuote, calculateEma } from './trend_calculator';
import { SepaPullbackMetrics } from '../../features/sepa/types/sepa';

/**
 * ミネルヴィニ流プルバック（21日EMA・50日SMA押し目 & ブレイク後押し目）を判定
 */
export function calculateSepaPullback(
  quotes: RawDailyQuote[],
  ema21: number | null,
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
    is_pullback_21_ema: false,
    is_pullback_50: false,
    has_breakout_prior: false,
    days_since_breakout: null,
    breakout_date: null,
    breakout_price: null,
    pullback_from_breakout_high_pct: null,
  };

  if (!quotes || quotes.length < 21 || !ema21 || !sma50) return defaultRes;

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
    // 21日EMAの傾き (5日前の21EMAと比較)
    let isEma21Rising = true;
    if (quotes.length >= 26) {
      const ema21_5dAgo = calculateEma(quotes.slice(5), 21);
      if (ema21 != null && ema21_5dAgo != null) {
        isEma21Rising = ema21 >= ema21_5dAgo * 0.995;
      }
    }

    const dist21 = ((currentPrice - ema21) / ema21) * 100;
    const highAbove21 = ((swingHigh20d - ema21) / ema21) * 100;

    // 【21日EMA押し目 (強勢浅押し)】
    if (
      isEma21Rising &&
      highAbove21 >= 3.5 &&
      pullbackDepthPct <= -3.0 &&
      pullbackDepthPct >= -12.0 &&
      dist21 >= -1.5 &&
      dist21 <= 3.5
    ) {
      defaultRes.is_pullback_21_ema = true;
    }

    // 【50日SMA押し目】
    const dist50 = ((currentPrice - sma50) / sma50) * 100;
    if (
      pullbackDepthPct <= -5.0 &&
      pullbackDepthPct >= -20.0 &&
      dist50 >= -1.5 &&
      dist50 <= 3.5
    ) {
      defaultRes.is_pullback_50 = true;
    }

    // 7. 過去3〜30営業日前の前提ブレイクアウト探索 (真のブレイク防衛ロジック適用)
    if (defaultRes.is_pullback_21_ema || defaultRes.is_pullback_50) {
      for (let t_bo = 3; t_bo <= 30; t_bo++) {
        if (t_bo >= quotes.length - 50) break;
        const boDay = quotes[t_bo];
        const boClose = boDay.adj_close;
        const boVol = boDay.adj_volume;

        // 当時の50日平均出来高
        const priorVol50 = quotes.slice(t_bo, t_bo + 50).reduce((sum, q) => sum + q.adj_volume, 0) / Math.min(50, quotes.length - t_bo);
        if (boVol < priorVol50 * 1.3) continue;

        // 【上ヒゲ排除: Close Location Value >= 0.70 (上位30%以内の高値引け大陽線)】
        const range = boDay.adj_high - boDay.adj_low;
        const clv = range > 0 ? (boClose - boDay.adj_low) / range : 1.0;
        if (clv < 0.70) continue;

        // 【防衛1: ベース期間(過去60営業日/約3ヶ月)の高値突破】
        const prior60Quotes = quotes.slice(t_bo + 1, Math.min(quotes.length, t_bo + 61));
        const prior60High = Math.max(...prior60Quotes.map(q => q.adj_high));
        if (boClose <= prior60High) continue;

        // 【防衛2: ブレイク日時点の Stage 2 健全性 (SMA50 > SMA200 & Close > SMA50)】
        if (quotes.length >= t_bo + 200) {
          const sma50AtBo = quotes.slice(t_bo, t_bo + 50).reduce((sum, q) => sum + q.adj_close, 0) / 50;
          const sma200AtBo = quotes.slice(t_bo, t_bo + 200).reduce((sum, q) => sum + q.adj_close, 0) / 200;
          if (sma50AtBo <= sma200AtBo || boClose <= sma50AtBo) continue;
        }

        // 【防衛3: ブレイク日時点で52週高値から -15% 以内 (大底からの戻り過程の排除)】
        const prior250Quotes = quotes.slice(t_bo + 1, Math.min(quotes.length, t_bo + 251));
        if (prior250Quotes.length >= 60) {
          const high52wAtBo = Math.max(...prior250Quotes.map(q => q.adj_high));
          if (high52wAtBo > 0 && boClose < high52wAtBo * 0.85) continue;
        }

        // 【防衛4: 押し目の健全な深さ】
        const postBoHigh = Math.max(...quotes.slice(0, t_bo + 1).map(q => q.adj_high));
        const pullbackFromBoHigh = postBoHigh > 0 ? ((currentPrice - postBoHigh) / postBoHigh) * 100 : 0;
        const isDepthValid = defaultRes.is_pullback_21_ema ? pullbackFromBoHigh >= -12.0 : pullbackFromBoHigh >= -20.0;

        if (isDepthValid) {
          defaultRes.has_breakout_prior = true;
          defaultRes.days_since_breakout = t_bo;
          defaultRes.breakout_date = boDay.date;
          defaultRes.breakout_price = boDay.adj_close;
          defaultRes.pullback_from_breakout_high_pct = Math.round(pullbackFromBoHigh * 10) / 10;
          break; // 最も直近の適合ブレイクを採用
        }
      }
    }
  }

  return defaultRes;
}
