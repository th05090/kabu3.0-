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
  period_end_date?: string | null;
  fiscal_quarter?: string | null;
}

export interface StandaloneQuarterData {
  date: string;
  period_end_date: string;
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
 * 開示日から四半期末日（フォールバック用）を概算算出
 * （通常、決算短信は四半期末の30〜45日後に開示される）
 */
function estimatePeriodEndDate(discDateStr: string): string {
  const d = new Date(discDateStr);
  d.setDate(d.getDate() - 45);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  let endMonth = 3;
  let endDay = 31;
  if (month <= 2) {
    return `${year - 1}-12-31`;
  } else if (month <= 5) {
    endMonth = 3;
    endDay = 31;
  } else if (month <= 8) {
    endMonth = 6;
    endDay = 30;
  } else if (month <= 11) {
    endMonth = 9;
    endDay = 30;
  } else {
    endMonth = 12;
    endDay = 31;
  }
  return `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
}

/**
 * 財務レコード一覧から、厳格な5段階パイプラインを経て「3ヶ月単体四半期データ」を時系列逆算して抽出
 */
export function parseStandaloneQuarters(rows: RawFinancialRow[]): StandaloneQuarterData[] {
  if (!rows || rows.length === 0) return [];

  // =========================================================================
  // ステップ1: 実績値フィルタリング
  // 「四半期実績値（net_sales または operating_profit）がどちらもnullの行」を明示的に除外
  // =========================================================================
  const validRows = rows.filter(r => r.net_sales != null || r.operating_profit != null);
  if (validRows.length === 0) return [];

  // =========================================================================
  // ステップ2: 対象会計期間終了日による一意キーマージ（デデュプリケーション）
  // 同一銘柄かつ同一の対象会計期間（period_end_date）が存在する場合、
  // 開示日（date）が最も新しいものを採用し、古い訂正前レコードを破棄する
  // =========================================================================
  const periodMap = new Map<string, RawFinancialRow>();
  for (const r of validRows) {
    const periodKey = r.period_end_date || estimatePeriodEndDate(r.date);
    const existing = periodMap.get(periodKey);
    if (!existing) {
      periodMap.set(periodKey, r);
    } else {
      // 開示日（date）がより新しい方を採用（最新の訂正開示を採用）
      if (r.date > existing.date) {
        periodMap.set(periodKey, r);
      }
    }
  }

  // =========================================================================
  // ステップ3: 対象会計期間の昇順ソート（古い期 -> 新しい期）
  // =========================================================================
  const deduplicated = Array.from(periodMap.entries()).map(([periodKey, row]) => ({
    periodKey,
    row,
  }));
  deduplicated.sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  // =========================================================================
  // ステップ4: 確定した最新累計値に基づく3ヶ月単体値の安全な差分逆算
  // =========================================================================
  const results: StandaloneQuarterData[] = [];

  for (let i = 0; i < deduplicated.length; i++) {
    const curItem = deduplicated[i];
    const cur = curItem.row;
    const prevItem = i > 0 ? deduplicated[i - 1] : null;
    const prev = prevItem ? prevItem.row : null;

    const sales = cur.net_sales != null ? cur.net_sales : 0;
    const op = cur.operating_profit != null ? cur.operating_profit : 0;
    const ord = cur.ordinary_profit != null ? cur.ordinary_profit : 0;
    const profit = cur.profit != null ? cur.profit : 0;
    const shares = cur.adj_shares_outstanding || 1;

    // 前四半期（periodKey）との日数差
    let daysDiff = 90;
    if (prevItem) {
      const curPeriodTime = new Date(curItem.periodKey).getTime();
      const prevPeriodTime = new Date(prevItem.periodKey).getTime();
      daysDiff = Math.round((curPeriodTime - prevPeriodTime) / (1000 * 60 * 60 * 24));
    }
    const isTooClose = prevItem ? daysDiff < 50 : false;

    // 累計差分の判定
    let stdSales = sales;
    let stdOp = op;
    let stdOrd = ord;
    let stdProfit = profit;
    let qType: '1Q' | '2Q' | '3Q' | '4Q' | 'UNKNOWN' = '1Q';

    if (cur.fiscal_quarter === '1Q') qType = '1Q';
    else if (cur.fiscal_quarter === '2Q') qType = '2Q';
    else if (cur.fiscal_quarter === '3Q') qType = '3Q';
    else if (cur.fiscal_quarter === 'FY') qType = '4Q';
    else if (prev && sales > (prev.net_sales || 0) && !isTooClose && daysDiff <= 130) {
      qType = '2Q';
    }

    let isMissingPriorQuarter = false;

    if (qType === '1Q') {
      // 1Qは減算なし（期初から3ヶ月の実績そのもの）
      stdSales = sales;
      stdOp = op;
      stdOrd = ord;
      stdProfit = profit;
    } else if (qType === '2Q') {
      // 2Q: 直前が1Qかつ日数差が正常（50〜130日）の場合のみ減算 (2Q累計 - 1Q)
      if (prev && !isTooClose && daysDiff <= 130 && (prev.fiscal_quarter === '1Q' || sales > (prev.net_sales || 0))) {
        stdSales = sales - (prev.net_sales || 0);
        stdOp = op - (prev.operating_profit || 0);
        stdOrd = ord - (prev.ordinary_profit || 0);
        stdProfit = profit - (prev.profit || 0);
      } else {
        isMissingPriorQuarter = true;
      }
    } else if (qType === '3Q') {
      // 3Q: 直前が2Qかつ日数差が正常（50〜130日）の場合のみ減算 (3Q累計 - 2Q累計)
      if (prev && !isTooClose && daysDiff <= 130 && (prev.fiscal_quarter === '2Q' || sales > (prev.net_sales || 0))) {
        stdSales = sales - (prev.net_sales || 0);
        stdOp = op - (prev.operating_profit || 0);
        stdOrd = ord - (prev.ordinary_profit || 0);
        stdProfit = profit - (prev.profit || 0);
      } else {
        isMissingPriorQuarter = true;
      }
    } else if (qType === '4Q') {
      // 4Q (FY): 直前が同一年度の3Qかつ日数差が正常（50〜130日）の場合のみ減算 (FY - 3Q累計)
      // 直前が1Qや2Qの場合は決して減算せず、異常値捏造を防ぐ
      if (prev && !isTooClose && daysDiff <= 130 && prev.fiscal_quarter === '3Q') {
        stdSales = sales - (prev.net_sales || 0);
        stdOp = op - (prev.operating_profit || 0);
        stdOrd = ord - (prev.ordinary_profit || 0);
        stdProfit = profit - (prev.profit || 0);
      } else {
        isMissingPriorQuarter = true;
      }
    } else {
      // フォールバック（四半期区分不明）: 前期より売上が増加かつ連続四半期と推定される場合
      if (prev && sales > (prev.net_sales || 0) && !isTooClose && daysDiff <= 130) {
        stdSales = sales - (prev.net_sales || 0);
        stdOp = op - (prev.operating_profit || 0);
        stdOrd = ord - (prev.ordinary_profit || 0);
        stdProfit = profit - (prev.profit || 0);
      }
    }

    // 変則決算ガード: 同一期間内の近接重複（50日未満）、直前四半期欠損、または単体売上マイナス
    const isSalesNegative = stdSales < 0 && sales > 0;
    const stdEps = shares > 0 ? stdProfit / shares : (cur.adj_eps || 0);

    results.push({
      date: cur.date,
      period_end_date: curItem.periodKey,
      quarter_type: qType,
      standalone_sales: stdSales,
      standalone_op: stdOp,
      standalone_ordinary_profit: stdOrd,
      standalone_profit: stdProfit,
      standalone_eps: stdEps,
      adj_shares_outstanding: shares,
      is_irregular_period: isTooClose || isSalesNegative || isMissingPriorQuarter,
    });
  }

  // 最新期が先頭に来るよう降順にして返却
  return results.reverse();
}
