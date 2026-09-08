import { RawDailyQuote } from './trend_calculator';
import { SepaRsMetrics } from '../../features/sepa/types/sepa';

export interface TickerQuotesMap {
  ticker: string;
  quotes: RawDailyQuote[]; // 最新日降順
}

/**
 * 個別銘柄の期間別動的加重RS生スコアを算出
 */
export function calculateRawRsScore(quotes: RawDailyQuote[]): { rawScore: number | null; isPseudo: boolean } {
  if (!quotes || quotes.length < 63) {
    return { rawScore: null, isPseudo: false }; // 63営業日未満は除外
  }

  const currentClose = quotes[0].adj_close;
  if (currentClose <= 0) return { rawScore: null, isPseudo: false };

  // 各期間の騰落率を計算
  const calcReturn = (days: number): number | null => {
    if (quotes.length <= days) return null;
    const pastClose = quotes[days].adj_close;
    if (pastClose <= 0) return null;
    return (currentClose - pastClose) / pastClose;
  };

  const r63 = calcReturn(63);
  const r126 = calcReturn(126);
  const r189 = calcReturn(189);
  const r252 = calcReturn(252);

  const daysCount = quotes.length;

  // 1. 63 〜 125日 (上場3〜6ヶ月): 100%加重 (擬似RS)
  if (daysCount < 126) {
    return { rawScore: r63, isPseudo: true };
  }

  // 2. 126 〜 188日 (上場6〜9ヶ月): 60% : 40% (擬似RS)
  if (daysCount < 189) {
    if (r63 != null && r126 != null) {
      return { rawScore: 0.6 * r63 + 0.4 * r126, isPseudo: true };
    }
    return { rawScore: r63, isPseudo: true };
  }

  // 3. 189 〜 251日 (上場9〜12ヶ月): 50% : 25% : 25% (擬似RS)
  if (daysCount < 252) {
    if (r63 != null && r126 != null && r189 != null) {
      return { rawScore: 0.5 * r63 + 0.25 * r126 + 0.25 * r189, isPseudo: true };
    }
    return { rawScore: r63, isPseudo: true };
  }

  // 4. 252日以上 (通常銘柄): 40% : 20% : 20% : 20% (正規RS)
  if (r63 != null && r126 != null && r189 != null && r252 != null) {
    return {
      rawScore: 0.4 * r63 + 0.2 * r126 + 0.2 * r189 + 0.2 * r252,
      isPseudo: false,
    };
  }

  return { rawScore: r63, isPseudo: true };
}

/**
 * 全銘柄の生スコアを母集団ソートし、1〜99のパーセンタイル・レーティングに一括正規化
 */
export function calculateAllRsRatings(allTickersQuotes: TickerQuotesMap[]): Map<string, SepaRsMetrics> {
  const resultMap = new Map<string, SepaRsMetrics>();
  const validList: { ticker: string; rawScore: number; isPseudo: boolean }[] = [];

  for (const item of allTickersQuotes) {
    const { rawScore, isPseudo } = calculateRawRsScore(item.quotes);
    if (rawScore != null && !isNaN(rawScore) && isFinite(rawScore)) {
      validList.push({ ticker: item.ticker, rawScore, isPseudo });
    } else {
      resultMap.set(item.ticker, {
        rs_score_raw: null,
        rs_rating: null,
        is_pseudo_rs: false,
      });
    }
  }

  // 生スコア昇順にソート (小さい順 -> 大きい順)
  validList.sort((a, b) => a.rawScore - b.rawScore);
  const total = validList.length;

  for (let rank = 1; rank <= total; rank++) {
    const item = validList[rank - 1];
    // 1〜99 パーセンタイル計算
    const percentile = total > 1 ? Math.round(((rank - 1) / (total - 1)) * 98) + 1 : 50;

    resultMap.set(item.ticker, {
      rs_score_raw: item.rawScore,
      rs_rating: percentile,
      is_pseudo_rs: item.isPseudo,
    });
  }

  return resultMap;
}
