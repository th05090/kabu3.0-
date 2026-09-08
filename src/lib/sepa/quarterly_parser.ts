/**
 * 日本企業の四半期累計開示から「3ヶ月単体値」を逆算・パースする純粋エンジン
 */

export interface RawFinancialRow {
  ticker: string;
  date: string;
  net_sales: number | null;
  operating_profit: number | null;
  ordinary_profit: number | null;
  profit: number | null;
  eps: number | null;
  adj_eps: number | null;
  adj_shares_outstanding: number | null;
}

export interface StandaloneQuarterData {
  date: string;
  quarter_type: '1Q' | '2Q' | '3Q' | '4Q' | 'UNKNOWN';
  standalone_sales: number;
  standalone_op: number;
  standalone_ordinary_profit: number;
  standalone_profit: number;
  standalone_eps: number;
  adj_shares_outstanding: number;
  is_irregular_period: boolean;
}

/**
 * 過去の財務レコード一覧から、直近N個の「3ヶ月単体四半期データ」を時系列逆算して抽出
 */
export function parseStandaloneQuarters(rows: RawFinancialRow[]): StandaloneQuarterData[] {
  if (!rows || rows.length === 0) return [];

  // 日付昇順にソート (古い順 -> 新しい順)
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const results: StandaloneQuarterData[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;

    const sales = cur.net_sales || 0;
    const op = cur.operating_profit || 0;
    const ord = cur.ordinary_profit || 0;
    const profit = cur.profit || 0;
    const shares = cur.adj_shares_outstanding || 1;

    // 前四半期との日数差
    let daysDiff = 90;
    if (prev) {
      const curTime = new Date(cur.date).getTime();
      const prevTime = new Date(prev.date).getTime();
      daysDiff = Math.round((curTime - prevTime) / (1000 * 60 * 60 * 24));
    }

    // 変則決算ガード: 開示間隔が短すぎる(50日未満)または長すぎる(140日超)
    const isIrregular = prev ? (daysDiff < 50 || daysDiff > 140) : false;

    // 累計差分の判定
    // 前のレコードより売上が大きければ同一年度内の累積進行中と判定
    let stdSales = sales;
    let stdOp = op;
    let stdOrd = ord;
    let stdProfit = profit;
    let qType: '1Q' | '2Q' | '3Q' | '4Q' | 'UNKNOWN' = '1Q';

    if (prev && sales > (prev.net_sales || 0) && !isIrregular) {
      // 累積差分 (2Q, 3Q, または 通期)
      stdSales = sales - (prev.net_sales || 0);
      stdOp = op - (prev.operating_profit || 0);
      stdOrd = ord - (prev.ordinary_profit || 0);
      stdProfit = profit - (prev.profit || 0);

      // 期間タイプの推定
      if (daysDiff >= 60 && daysDiff <= 110) {
        qType = '2Q'; // 直前が1Qと推定
      }
    } else {
      // 売上がリセットされた (新しい会計年度の1Q)
      qType = '1Q';
    }

    const stdEps = shares > 0 ? stdProfit / shares : (cur.adj_eps || 0);

    results.push({
      date: cur.date,
      quarter_type: qType,
      standalone_sales: stdSales,
      standalone_op: stdOp,
      standalone_ordinary_profit: stdOrd,
      standalone_profit: stdProfit,
      standalone_eps: stdEps,
      adj_shares_outstanding: shares,
      is_irregular_period: isIrregular || stdSales < 0, // 売上マイナスは変則
    });
  }

  // 最新日付が先頭に来るよう降順にして返却
  return results.reverse();
}
