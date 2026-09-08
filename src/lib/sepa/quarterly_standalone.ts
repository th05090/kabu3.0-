import { RawFinancialRow, StandaloneQuarterData, parseStandaloneQuarters } from './quarterly_parser';
import { QuarterlyGrowthStatus, SepaFundamentalsMetrics } from '../../features/sepa/types/sepa';

/**
 * 前年同期との比較を行い、四半期成長率・加速・利益率改善・ステータスを判定
 */
export function calculateSepaFundamentals(
  rows: RawFinancialRow[],
  marketCap: number | null,
  avgTurnover5d: number | null,
  currentRoe: number | null
): SepaFundamentalsMetrics {
  const defaultRes: SepaFundamentalsMetrics = {
    sales_yoy_pct: null,
    op_yoy_pct: null,
    ordinary_profit_yoy_pct: null,
    eps_yoy_pct: null,
    growth_status: 'NO_DATA',
    is_growth_accelerating: false,
    is_margin_expanding: false,
    has_3y_annual_growth: false,
    has_accounting_noise_risk: false,
    standalone_sales: null,
    standalone_op: null,
    standalone_profit: null,
    standalone_eps: null,
    roe: currentRoe,
    market_cap: marketCap,
    avg_trading_value_5d: avgTurnover5d,
  };

  if (!rows || rows.length === 0) return defaultRes;

  const standaloneList = parseStandaloneQuarters(rows);
  if (standaloneList.length === 0) return defaultRes;

  const latest = standaloneList[0];
  defaultRes.standalone_sales = latest.standalone_sales;
  defaultRes.standalone_op = latest.standalone_op;
  defaultRes.standalone_profit = latest.standalone_profit;
  defaultRes.standalone_eps = latest.standalone_eps;

  if (latest.is_irregular_period) {
    defaultRes.growth_status = 'IRREGULAR_PERIOD';
    return defaultRes;
  }

  // 1. 前年同期 (4四半期前) の単体を探索 (対象期末日ベースで約320日〜410日前)
  const latestPeriodTime = new Date(latest.period_end_date || latest.date).getTime();
  let prevYearQuarter: StandaloneQuarterData | null = null;
  let prevQuarter: StandaloneQuarterData | null = standaloneList.length > 1 ? standaloneList[1] : null;

  for (let i = 1; i < standaloneList.length; i++) {
    const q = standaloneList[i];
    const qPeriodTime = new Date(q.period_end_date || q.date).getTime();
    const diffDays = Math.round((latestPeriodTime - qPeriodTime) / (1000 * 60 * 60 * 24));
    if (diffDays >= 300 && diffDays <= 420) {
      prevYearQuarter = q;
      break;
    }
  }

  // 4四半期前がなければインデックス4を採用（四半期がデデュプ済みのため）
  if (!prevYearQuarter && standaloneList.length >= 5) {
    prevYearQuarter = standaloneList[4];
  }

  // 前年同期が存在する場合のYoY計算
  if (prevYearQuarter && (prevYearQuarter.standalone_sales > 0 || !prevYearQuarter.is_irregular_period)) {
    const curSales = latest.standalone_sales;
    const prevSales = prevYearQuarter.standalone_sales;
    const curOp = latest.standalone_op;
    const prevOp = prevYearQuarter.standalone_op;
    const curOrd = latest.standalone_ordinary_profit;
    const prevOrd = prevYearQuarter.standalone_ordinary_profit;
    const curEps = latest.standalone_eps;
    const prevEps = prevYearQuarter.standalone_eps;

    // 売上成長率
    if (prevSales > 0) {
      defaultRes.sales_yoy_pct = ((curSales - prevSales) / prevSales) * 100;
    }

    // 営業利益成長率
    if (prevOp > 0) {
      defaultRes.op_yoy_pct = ((curOp - prevOp) / prevOp) * 100;
    }

    // 経常利益成長率
    if (prevOrd > 0) {
      defaultRes.ordinary_profit_yoy_pct = ((curOrd - prevOrd) / prevOrd) * 100;
    }

    // EPS YoY成長率 (前年プラスの場合のみ安全に計算)
    let epsGrowth: number | null = null;
    if (prevEps > 0) {
      epsGrowth = ((curEps - prevEps) / prevEps) * 100;
      defaultRes.eps_yoy_pct = epsGrowth;
    } else {
      defaultRes.eps_yoy_pct = null; // 前年赤字は符号逆転バグ防止のためnull
    }

    // =========================================================================
    // ステータス判定 (営業利益 Operating Profit を主軸とした投資的判定)
    // =========================================================================
    if (prevOp <= 0 && curOp > 0) {
      // 1. 本業が赤字から黒字へ劇的復活
      defaultRes.growth_status = 'TURNAROUND';
    } else if (prevOp > 0 && curOp <= 0) {
      // 2. 本業が黒字から赤字へ転落 (真の赤字転落)
      defaultRes.growth_status = 'DEFICIT_FALL';
    } else if (prevOp <= 0 && curOp <= 0) {
      // 3. 本業が赤字継続
      if (curOp > prevOp) {
        defaultRes.growth_status = 'LOSS_REDUCTION'; // 赤字縮小
      } else {
        defaultRes.growth_status = 'LOSS_EXPANSION'; // 赤字拡大
      }
    } else {
      // 4. 本業は黒字継続 (prevOp > 0 && curOp > 0)
      if (curEps <= 0) {
        // 本業は黒字だが特損等で最終赤字 -> DEFICIT_FALLにはせず、黒字枠として特損リスクを注記
        defaultRes.growth_status = 'GROWTH';
        defaultRes.has_accounting_noise_risk = true;
      } else if (prevEps <= 0 && curEps > 0) {
        // 営業黒字継続下で、純利益が赤字から黒字転換
        defaultRes.growth_status = 'TURNAROUND';
      } else {
        // 営業・純利益ともに黒字
        const salesGrowth = defaultRes.sales_yoy_pct ?? 0;
        if (epsGrowth != null && epsGrowth >= 300) {
          if (salesGrowth >= 10) {
            defaultRes.growth_status = 'EXPLOSIVE_GROWTH';
          } else {
            defaultRes.growth_status = 'GROWTH';
            defaultRes.has_accounting_noise_risk = true; // 売上を伴わない利益急増
          }
        } else {
          defaultRes.growth_status = 'GROWTH';
        }
      }
    }

    // 営業利益率の改善 (単体ベース)
    if (curSales > 0 && prevSales > 0) {
      const curMargin = curOp / curSales;
      const prevMargin = prevOp / prevSales;
      defaultRes.is_margin_expanding = curMargin > prevMargin;
    }
  }

  // 2. 成長の加速判定 (売上高またはEPSの当四半期YoY > 前四半期YoY かつ 最低成長水準を満たすこと)
  // ※赤字縮小（-50% -> -20%）や超低成長（+1% -> +3%）を排除し、真のモメンタム加速のみを検知
  if (prevQuarter && standaloneList.length >= 6) {
    const prevQ_PrevYear = standaloneList[5];
    if (prevQ_PrevYear && !prevQuarter.is_irregular_period && !prevQ_PrevYear.is_irregular_period) {
      // 売上高の加速チェック (当期YoY > 前期YoY かつ 当期売上YoY >= +10.0%)
      let isSalesAccelerating = false;
      if (prevQuarter.standalone_sales > 0 && prevQ_PrevYear.standalone_sales > 0) {
        const prevQ_salesYoY = ((prevQuarter.standalone_sales - prevQ_PrevYear.standalone_sales) / prevQ_PrevYear.standalone_sales) * 100;
        const curSalesYoY = defaultRes.sales_yoy_pct;
        if (curSalesYoY != null && curSalesYoY > prevQ_salesYoY && curSalesYoY >= 10.0) {
          isSalesAccelerating = true;
        }
      }

      // EPSの加速チェック (当期YoY > 前期YoY かつ 当期EPS YoY >= +15.0%)
      let isEpsAccelerating = false;
      if (prevQuarter.standalone_eps > 0 && prevQ_PrevYear.standalone_eps > 0) {
        const prevQ_epsYoY = ((prevQuarter.standalone_eps - prevQ_PrevYear.standalone_eps) / prevQ_PrevYear.standalone_eps) * 100;
        const curEpsYoY = defaultRes.eps_yoy_pct;
        if (curEpsYoY != null && curEpsYoY > prevQ_epsYoY && curEpsYoY >= 15.0) {
          isEpsAccelerating = true;
        }
      }

      defaultRes.is_growth_accelerating = isSalesAccelerating || isEpsAccelerating;
    }
  }

  // 3. 過去3期の通期EPS持続性判定 (株式分割遡及済みの adj_eps を用いて比較)
  // 通期本決算 (FY) レコードのみを抽出して比較
  const fyRecords = rows
    .filter(r => (r.fiscal_quarter === 'FY' || r.net_sales != null) && (r.net_sales || 0) > 0)
    .sort((a, b) => (b.period_end_date || b.date).localeCompare(a.period_end_date || a.date));

  // 重複期末日を除去
  const uniqueFy: RawFinancialRow[] = [];
  const seenFy = new Set<string>();
  for (const r of fyRecords) {
    const key = r.period_end_date || r.date.slice(0, 4);
    if (!seenFy.has(key)) {
      seenFy.add(key);
      uniqueFy.push(r);
    }
  }

  if (uniqueFy.length >= 3) {
    const eps0 = uniqueFy[0].adj_eps ?? 0;
    const eps1 = uniqueFy[1].adj_eps ?? 0;
    const eps2 = uniqueFy[2].adj_eps ?? 0;
    defaultRes.has_3y_annual_growth = (eps0 > eps1) && (eps1 > eps2) && (eps2 > 0);
  } else if (uniqueFy.length === 2) {
    // IPO新興株バイパス: 上場後2期の場合
    const eps0 = uniqueFy[0].adj_eps ?? 0;
    const eps1 = uniqueFy[1].adj_eps ?? 0;
    defaultRes.has_3y_annual_growth = (eps0 > eps1) && (eps1 > 0);
  } else if (uniqueFy.length === 1) {
    // IPO新興株バイパス: 上場直後1期の場合
    defaultRes.has_3y_annual_growth = (uniqueFy[0].adj_eps ?? 0) > 0;
  }

  return defaultRes;
}
