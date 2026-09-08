import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'near_pivot'; // 'near_pivot', 'breakout', 'vdu_dryup', 'all', 'strict_funda'
    const excludeEtf = searchParams.get('exclude_etf') !== 'false'; // デフォルトで投信・ETF等を除外 (true)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['is_trend_template_pass = 1']; // Stage 2トレンド合格を大前提
    const args: any[] = [];

    if (excludeEtf) {
      conditions.push('is_operating_company = 1');
    }

    if (mode === 'near_pivot') {
      conditions.push('is_near_pivot = 1');
    } else if (mode === 'breakout') {
      conditions.push('is_pivot_breakout = 1');
    } else if (mode === 'vdu_dryup') {
      conditions.push('is_volume_dryup = 1');
    } else if (mode === 'all') {
      conditions.push('(is_near_pivot = 1 OR is_volume_dryup = 1 OR is_volatility_contracted = 1)');
    } else if (mode === 'strict_funda') {
      conditions.push('rs_rating >= 80 AND is_growth_accelerating = 1 AND is_margin_expanding = 1 AND market_cap >= 100 AND market_cap <= 1000 AND avg_trading_value_5d >= 1.0');
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as total FROM sepa_metrics WHERE ${whereClause}`,
      args
    });
    const total = Number(countRes.rows[0]?.total || 0);

    const validSortColumns: Record<string, string> = {
      ticker: 'ticker',
      current_price: 'current_price',
      pivot_price: 'pivot_price',
      pivot_distance_pct: 'pivot_distance_pct',
      atr_contraction_ratio: 'atr_contraction_ratio',
      volume_dryup_ratio: 'volume_dryup_ratio',
      rs_rating: 'rs_rating',
    };

    const sortBy = searchParams.get('sort_by');
    const order = searchParams.get('order')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let orderSql = 'ORDER BY is_pivot_breakout DESC, is_near_pivot DESC, pivot_distance_pct DESC, rs_rating DESC';
    if (sortBy && validSortColumns[sortBy]) {
      const col = validSortColumns[sortBy];
      orderSql = `ORDER BY ${col} IS NULL ASC, ${col} ${order}`;
    }

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
    console.error('SEPA VCP Candidates API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
