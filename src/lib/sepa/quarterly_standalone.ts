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

  // 1. 前年同期 (4四半期前) の単体を探索 (日付で約300日〜420日前)
  const latestTime = new Date(latest.date).getTime();
  let prevYearQuarter: StandaloneQuarterData | null = null;
  let prevQuarter: StandaloneQuarterData | null = standaloneList.length > 1 ? standaloneList[1] : null;

  for (let i = 1; i < standaloneList.length; i++) {
    const q = standaloneList[i];
    const diffDays = Math.round((latestTime - new Date(q.date).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 300 && diffDays <= 420) {
      prevYearQuarter = q;
      break;
    }
  }

  // 4四半期前がなければインデックス4を採用
  if (!prevYearQuarter && standaloneList.length >= 5) {
    prevYearQuarter = standaloneList[4];
  }

  // 前年同期が存在する場合のYoY計算
  if (prevYearQuarter && !prevYearQuarter.is_irregular_period) {
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

    // EPSステータス ＆ 成長率判定 (符号逆転バグ防止)
    if (prevEps <= 0) {
      if (curEps > 0) {
        defaultRes.growth_status = 'TURNAROUND'; // 黒字転換
      } else if (curEps > prevEps) {
        defaultRes.growth_status = 'LOSS_REDUCTION'; // 赤字縮小
      } else {
        defaultRes.growth_status = 'LOSS_EXPANSION'; // 赤字拡大
      }
      defaultRes.eps_yoy_pct = null; // 前年赤字は%未算出
    } else {
      if (curEps < 0) {
        defaultRes.growth_status = 'DEFICIT_FALL'; // 赤字転落
        defaultRes.eps_yoy_pct = ((curEps - prevEps) / prevEps) * 100;
      } else {
        const epsGrowth = ((curEps - prevEps) / prevEps) * 100;
        defaultRes.eps_yoy_pct = epsGrowth;

        // Q4会計調整ノイズチェック
        const salesGrowth = defaultRes.sales_yoy_pct ?? 0;
        if (epsGrowth >= 300) {
          if (salesGrowth >= 10) {
            defaultRes.growth_status = 'EXPLOSIVE_GROWTH';
          } else {
            defaultRes.growth_status = 'GROWTH';
            defaultRes.has_accounting_noise_risk = true; // ⚠️ 売上が伴わない利益急増
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

  // 2. 成長の加速判定 (当四半期YoY > 前四半期YoY)
  if (prevQuarter && standaloneList.length >= 6) {
    const prevQ_PrevYear = standaloneList[5];
    if (prevQ_PrevYear && prevQuarter.standalone_sales > 0 && prevQ_PrevYear.standalone_sales > 0) {
      const prevQ_salesYoY = ((prevQuarter.standalone_sales - prevQ_PrevYear.standalone_sales) / prevQ_PrevYear.standalone_sales) * 100;
      if (defaultRes.sales_yoy_pct != null && defaultRes.sales_yoy_pct > prevQ_salesYoY) {
        defaultRes.is_growth_accelerating = true;
      }
    }
  }

  // 3. 過去3期の通期EPS持続性判定 (通期レコードのみを抽出して比較)
  const fyRecords = rows.filter(r => (r.net_sales || 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  
  // 売上が年々最大となる本決算候補を3期抽出
  if (fyRecords.length >= 3) {
    const eps0 = fyRecords[0].adj_eps ?? 0;
    const eps1 = fyRecords[1].adj_eps ?? 0;
    const eps2 = fyRecords[2].adj_eps ?? 0;
    defaultRes.has_3y_annual_growth = (eps0 > eps1) && (eps1 > eps2) && (eps2 > 0);
  }

  return defaultRes;
}
