import { SepaTrendMetrics } from '../../features/sepa/types/sepa';

export interface RawDailyQuote {
  date: string;
  adj_open: number;
  adj_high: number;
  adj_low: number;
  adj_close: number;
  adj_volume: number;
}

/**
 * 最小二乗法による22日線形回帰スロープを算出
 */
function calculateLinearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;
  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * 単純移動平均 (SMA) 算出
 */
function calculateSma(quotes: RawDailyQuote[], period: number): number | null {
  if (quotes.length < period) return null;
  const slice = quotes.slice(0, period);
  const sum = slice.reduce((acc, q) => acc + q.adj_close, 0);
  return sum / period;
}

/**
 * ミネルヴィニ・トレンドテンプレート8条件およびIPOバイパスを計算
 */
export function calculateSepaTrend(quotes: RawDailyQuote[]): SepaTrendMetrics {
  // quotes は最新日降順 (0が最新)
  const defaultRes: SepaTrendMetrics = {
    current_price: 0,
    sma_50: null,
    sma_150: null,
    sma_200: null,
    is_above_sma_50: false,
    is_above_sma_150: false,
    is_above_sma_200: false,
    is_sma_50_above_150_200: false,
    is_sma_150_above_200: false,
    sma_200_slope_22d: null,
    is_sma200_uptrend_1m: false,
    is_sma200_uptrend_5m: false,
    low_52w: null,
    distance_from_low_52w_pct: null,
    high_52w: null,
    distance_to_high_52w_pct: null,
    is_ipo: false,
    is_trend_template_pass: false,
    passed_conditions_count: 0,
    stage2_entry_date: null,
  };

  if (!quotes || quotes.length === 0) return defaultRes;

  const currentPrice = quotes[0].adj_close;
  defaultRes.current_price = currentPrice;

  // 1. IPO判定 (データ存在日数が250営業日未満)
  const isIpo = quotes.length < 250;
  defaultRes.is_ipo = isIpo;

  // 2. 移動平均線の算出
  const sma50 = calculateSma(quotes, 50);
  const sma150 = calculateSma(quotes, 150);
  const sma200 = calculateSma(quotes, 200);

  defaultRes.sma_50 = sma50;
  defaultRes.sma_150 = sma150;
  defaultRes.sma_200 = sma200;

  defaultRes.is_above_sma_50 = sma50 != null && currentPrice > sma50;
  defaultRes.is_above_sma_150 = sma150 != null && currentPrice > sma150;
  defaultRes.is_above_sma_200 = sma200 != null && currentPrice > sma200;

  defaultRes.is_sma_50_above_150_200 =
    sma50 != null && sma150 != null && sma200 != null && sma50 > sma150 && sma50 > sma200;
  defaultRes.is_sma_150_above_200 = sma150 != null && sma200 != null && sma150 > sma200;

  // 3. 200日SMAの22日スロープ & 緩和上向き判定
  // 直近22日間のSMA200系列を算出
  if (quotes.length >= 222) {
    const sma200Series: number[] = [];
    for (let d = 21; d >= 0; d--) {
      // d日前のSMA200
      const sub = quotes.slice(d, d + 200);
      const sum = sub.reduce((acc, q) => acc + q.adj_close, 0);
      sma200Series.push(sum / 200);
    }

    const slope = calculateLinearRegressionSlope(sma200Series);
    defaultRes.sma_200_slope_22d = slope;

    const sma200Today = sma200Series[sma200Series.length - 1];
    const sma200_10dAgo = sma200Series[sma200Series.length - 11] ?? sma200Today;
    const sma200_22dAgo = sma200Series[0];

    // 緩和判定: スロープ正 かつ 22日前以上 かつ 10日前以上
    defaultRes.is_sma200_uptrend_1m = slope > 0 && sma200Today >= sma200_22dAgo && sma200Today >= sma200_10dAgo;

    // 5ヶ月上向き (105日前のSMA200と比較)
    if (quotes.length >= 305) {
      const sub105 = quotes.slice(105, 305);
      const sma200_105dAgo = sub105.reduce((acc, q) => acc + q.adj_close, 0) / 200;
      defaultRes.is_sma200_uptrend_5m = sma200Today > sma200_105dAgo;
    }
  }

  // 4. 52週高値・安値の算出 (IPOの場合は上場来)
  const windowDays = Math.min(quotes.length, 250);
  const windowQuotes = quotes.slice(0, windowDays);
  const high52w = Math.max(...windowQuotes.map(q => q.adj_high));
  const low52w = Math.min(...windowQuotes.map(q => q.adj_low));

  defaultRes.high_52w = high52w;
  defaultRes.low_52w = low52w;

  if (high52w > 0) {
    defaultRes.distance_to_high_52w_pct = ((currentPrice - high52w) / high52w) * 100;
  }
  if (low52w > 0) {
    defaultRes.distance_from_low_52w_pct = ((currentPrice - low52w) / low52w) * 100;
  }

  // 5. 条件クリア判定 (IPOバイパス対応)
  let passedCount = 0;
  const isHighCondition = defaultRes.distance_to_high_52w_pct != null && defaultRes.distance_to_high_52w_pct >= -25;
  const isLowCondition = defaultRes.distance_from_low_52w_pct != null && defaultRes.distance_from_low_52w_pct >= 25;

  if (isIpo) {
    // IPOバイパス判定
    const sma20 = calculateSma(quotes, 20);
    const isAboveSma = sma50 ? currentPrice > sma50 : (sma20 ? currentPrice > sma20 : true);
    defaultRes.is_trend_template_pass = isAboveSma && isHighCondition && isLowCondition;
    defaultRes.passed_conditions_count = defaultRes.is_trend_template_pass ? 8 : 4;
  } else {
    // 通常8条件チェック (RS除く7つのテクニカル条件)
    if (defaultRes.is_above_sma_150 && defaultRes.is_above_sma_200) passedCount++;
    if (defaultRes.is_sma_150_above_200) passedCount++;
    if (defaultRes.is_sma200_uptrend_1m) passedCount++;
    if (defaultRes.is_sma_50_above_150_200) passedCount++;
    if (defaultRes.is_above_sma_50) passedCount++;
    if (isLowCondition) passedCount++;
    if (isHighCondition) passedCount++;

    defaultRes.passed_conditions_count = passedCount; // (RS70以上が加わると最大8)
    defaultRes.is_trend_template_pass = passedCount >= 7;
  }

  // 6. 直近のStage 2突入日 (再浮上日) を過去時系列から逆算探索
  if (defaultRes.is_trend_template_pass && quotes.length >= 200) {
    let lastPassDate = quotes[0].date;
    const maxLookback = Math.min(quotes.length - 200, 90);

    for (let i = 1; i < maxLookback; i++) {
      const subQuotes = quotes.slice(i);
      const subTrend = checkQuickTrendPass(subQuotes);
      if (!subTrend) {
        // i日前の時点で不合格だったため、その直後の営業日 (i - 1) が直近のStage 2突入日
        defaultRes.stage2_entry_date = lastPassDate;
        break;
      }
      lastPassDate = quotes[i].date;
      if (i === maxLookback - 1) {
        defaultRes.stage2_entry_date = lastPassDate;
      }
    }
    if (!defaultRes.stage2_entry_date) {
      defaultRes.stage2_entry_date = lastPassDate;
    }
  }

  return defaultRes;
}

/**
 * 過去日付用の高速トレンド合否判定
 */
function checkQuickTrendPass(quotes: RawDailyQuote[]): boolean {
  if (quotes.length < 200) return false;
  const currentPrice = quotes[0].adj_close;

  const sma50 = calculateSma(quotes, 50);
  const sma150 = calculateSma(quotes, 150);
  const sma200 = calculateSma(quotes, 200);
  if (!sma50 || !sma150 || !sma200) return false;

  // 移動平均の並び・株価位置
  if (currentPrice <= sma50 || currentPrice <= sma150 || currentPrice <= sma200) return false;
  if (sma150 <= sma200 || sma50 <= sma150) return false;

  // 200日SMAの上向き (22日前との比較)
  const sub22 = quotes.slice(22, 222);
  if (sub22.length < 200) return false;
  const sma200_22dAgo = sub22.reduce((acc, q) => acc + q.adj_close, 0) / 200;
  if (sma200 <= sma200_22dAgo) return false;

  // 52週高値安値
  const windowDays = Math.min(quotes.length, 250);
  const windowQuotes = quotes.slice(0, windowDays);
  const high52w = Math.max(...windowQuotes.map(q => q.adj_high));
  const low52w = Math.min(...windowQuotes.map(q => q.adj_low));

  if (high52w > 0 && ((currentPrice - high52w) / high52w) * 100 < -25) return false;
  if (low52w > 0 && ((currentPrice - low52w) / low52w) * 100 < 25) return false;

  return true;
}
