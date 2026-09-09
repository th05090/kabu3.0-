import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const filter = searchParams.get('filter') || 'tier1';
    const excludeEtf = searchParams.get('exclude_etf') !== 'false';
    const minRs = searchParams.get('min_rs') ? Number(searchParams.get('min_rs')) : null;
    const accelerating = searchParams.get('accelerating') === 'true';
    const marginExpansion = searchParams.get('margin_expansion') === 'true';
    const sweetSpotCap = searchParams.get('sweet_spot_cap') === 'true';
    const midLargeCap = searchParams.get('mid_large_cap') === 'true';
    const minLiquidity = searchParams.get('min_liquidity') === 'true';
    const minSalesGrowth = searchParams.get('min_sales_growth') ? Number(searchParams.get('min_sales_growth')) : null;
    const minProfitGrowth = searchParams.get('min_profit_growth') ? Number(searchParams.get('min_profit_growth')) : null;
    const minEpsGrowth = searchParams.get('min_eps_growth') ? Number(searchParams.get('min_eps_growth')) : null;
    const minRoe = searchParams.get('min_roe') ? Number(searchParams.get('min_roe')) : null;
    const annualGrowth = searchParams.get('annual_growth') === 'true';
    const strictFunda = searchParams.get('strict_funda') === 'true';
    const search = searchParams.get('search') || '';

    const conditions: string[] = ['1 = 1'];
    const args: any[] = [];

    if (excludeEtf) {
      conditions.push('is_operating_company = 1');
    }

    if (filter === 'tier1') {
      // Tier 1 (基本ハードフィルター): Stage 2 + 直近Q売上+10%↑ + 直近Q EPS+20%↑(または黒字転換)
      conditions.push('is_trend_template_pass = 1');
      conditions.push('sales_yoy_pct >= 10.0');
      conditions.push('(eps_yoy_pct >= 20.0 OR growth_status = \'TURNAROUND\')');
    } else if (filter === 'all_pass') {
      conditions.push('is_trend_template_pass = 1');
    } else if (filter === 'ipo_only') {
      conditions.push('is_ipo = 1');
    } else if (filter === 'turnaround') {
      conditions.push("growth_status = 'TURNAROUND'");
    }

    if (minRs != null) {
      conditions.push('rs_rating >= ?');
      args.push(minRs);
    }

    if (accelerating) {
      conditions.push('is_growth_accelerating = 1');
    }

    if (marginExpansion) {
      conditions.push('is_margin_expanding = 1');
    }

    if (minSalesGrowth != null) {
      conditions.push('sales_yoy_pct >= ?');
      args.push(minSalesGrowth);
    }

    if (minProfitGrowth != null) {
      conditions.push('(op_yoy_pct >= ? OR ordinary_profit_yoy_pct >= ? OR growth_status = \'TURNAROUND\')');
      args.push(minProfitGrowth, minProfitGrowth);
    }

    if (minEpsGrowth != null) {
      conditions.push('(eps_yoy_pct >= ? OR growth_status = \'TURNAROUND\')');
      args.push(minEpsGrowth);
    }

    if (minRoe != null) {
      conditions.push('roe >= ?');
      args.push(minRoe);
    }

    if (annualGrowth) {
      conditions.push('has_3y_annual_growth = 1');
    }

    // 厳格ファンダメンタルズ一括適用 (純粋財務条件1〜7のみ。時価総額・流動性は独立)
    if (strictFunda) {
      conditions.push('sales_yoy_pct >= 15.0');
      conditions.push('(op_yoy_pct >= 20.0 OR ordinary_profit_yoy_pct >= 20.0 OR growth_status = \'TURNAROUND\')');
      conditions.push('(eps_yoy_pct >= 20.0 OR growth_status = \'TURNAROUND\')');
      conditions.push('is_growth_accelerating = 1');
      conditions.push('is_margin_expanding = 1');
      conditions.push('has_3y_annual_growth = 1');
      conditions.push('roe >= 15.0');
    }

    if (sweetSpotCap) {
      conditions.push('market_cap >= 100 AND market_cap <= 1000');
    }

    if (midLargeCap) {
      conditions.push('market_cap >= 300 AND market_cap <= 3000');
    }

    if (minLiquidity) {
      conditions.push('avg_trading_value_5d >= 1.0');
    }

    if (search) {
      conditions.push('(ticker LIKE ? OR name LIKE ?)');
      args.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.join(' AND ');

    // 総件数取得
    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as total FROM sepa_metrics WHERE ${whereClause}`,
      args
    });
    const total = Number(countRes.rows[0]?.total || 0);

    const fundaScoreExpr = `(
      (CASE WHEN is_growth_accelerating = 1 THEN 1 ELSE 0 END) +
      (CASE WHEN is_margin_expanding = 1 THEN 1 ELSE 0 END) +
      (CASE WHEN has_3y_annual_growth = 1 THEN 1 ELSE 0 END) +
      (CASE WHEN roe >= 15.0 THEN 1 ELSE 0 END)
    )`;

    const validSortColumns: Record<string, string> = {
      ticker: 'ticker',
      current_price: 'current_price',
      rs_rating: 'rs_rating',
      passed_conditions_count: 'passed_conditions_count',
      stage2_entry_date: 'stage2_entry_date',
      sales_yoy_pct: 'sales_yoy_pct',
      eps_yoy_pct: 'eps_yoy_pct',
      market_cap: 'market_cap',
      funda_score: fundaScoreExpr,
    };

    const sortBy = searchParams.get('sort_by');
    const order = searchParams.get('order')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let orderSql = 'ORDER BY is_trend_template_pass DESC, rs_rating DESC, distance_to_high_52w_pct DESC';
    if (sortBy && validSortColumns[sortBy]) {
      const col = validSortColumns[sortBy];
      if (sortBy === 'funda_score') {
        orderSql = `ORDER BY ${col} ${order}, rs_rating DESC`;
      } else {
        orderSql = `ORDER BY ${col} IS NULL ASC, ${col} ${order}`;
      }
    }

    // データ取得
    const dataRes = await db.execute({
      sql: `SELECT *, ${fundaScoreExpr} as funda_score FROM sepa_metrics 
            WHERE ${whereClause} 
            ${orderSql}
            LIMIT ? OFFSET ?`,
      args: [...args, limit, offset]
    });

    return NextResponse.json({
      success: true,
      data: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    console.error('SEPA Trend API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
