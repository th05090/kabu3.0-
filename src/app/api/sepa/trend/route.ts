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

    const filter = searchParams.get('filter') || 'all_pass'; // 'all_pass', 'all', 'ipo_only', 'turnaround'
    const minRs = searchParams.get('min_rs') ? parseInt(searchParams.get('min_rs')!) : null;
    const search = searchParams.get('search')?.trim();
    const excludeEtf = searchParams.get('exclude_etf') !== 'false'; // デフォルトで投信・ETF等を除外 (true)
    const accelerating = searchParams.get('accelerating') === 'true';
    const marginExpansion = searchParams.get('margin_expansion') === 'true';
    const sweetSpotCap = searchParams.get('sweet_spot_cap') === 'true'; // 100〜1,000億円
    const minLiquidity = searchParams.get('min_liquidity') === 'true'; // 売売代金1億円以上

    const conditions: string[] = ['1 = 1'];
    const args: any[] = [];

    if (excludeEtf) {
      conditions.push('is_operating_company = 1');
    }

    if (filter === 'all_pass') {
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

    if (sweetSpotCap) {
      conditions.push('market_cap >= 100 AND market_cap <= 1000');
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

    const validSortColumns: Record<string, string> = {
      ticker: 'ticker',
      current_price: 'current_price',
      rs_rating: 'rs_rating',
      passed_conditions_count: 'passed_conditions_count',
      stage2_entry_date: 'stage2_entry_date',
      sales_yoy_pct: 'sales_yoy_pct',
      eps_yoy_pct: 'eps_yoy_pct',
      market_cap: 'market_cap',
    };

    const sortBy = searchParams.get('sort_by');
    const order = searchParams.get('order')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let orderSql = 'ORDER BY is_trend_template_pass DESC, rs_rating DESC, distance_to_high_52w_pct DESC';
    if (sortBy && validSortColumns[sortBy]) {
      const col = validSortColumns[sortBy];
      orderSql = `ORDER BY ${col} IS NULL ASC, ${col} ${order}`;
    }

    // データ取得
    const dataRes = await db.execute({
      sql: `SELECT * FROM sepa_metrics 
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
