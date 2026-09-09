import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'strict_funda'; // 'strict_funda', 'stage2_pullback_25', 'stage2_pullback_50', 'all'
    const excludeEtf = searchParams.get('exclude_etf') !== 'false'; // デフォルトで投信・ETF等を除外 (true)
    const sweetSpotCap = searchParams.get('sweet_spot_cap') === 'true'; // 時価総額100〜1,000億のオプショントグル
    const midLargeCap = searchParams.get('mid_large_cap') === 'true'; // 時価総額300〜3,000億のオプショントグル
    const minLiquidity = searchParams.get('min_liquidity') === 'true'; // 売買代金1億以上のオプショントグル
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const args: any[] = [];

    if (excludeEtf) {
      conditions.push('is_operating_company = 1');
    }

    if (mode === 'stage2_pullback_25') {
      // 25日SMA押し目モード: 構造的Stage 2 + 25日押し目成立 + RS>=75
      conditions.push('is_pullback_25 = 1');
      conditions.push('rs_rating >= 75');
    } else if (mode === 'stage2_pullback_50') {
      // 50日SMA押し目モード: 構造的Stage 2 + 50日押し目成立 + RS>=75
      conditions.push('is_pullback_50 = 1');
      conditions.push('rs_rating >= 75');
    } else if (mode === 'all') {
      conditions.push('is_trend_template_pass = 1');
      conditions.push('(is_near_pivot = 1 OR is_volume_dryup = 1 OR is_volatility_contracted = 1)');
    } else {
      // デフォルト: Tier 1 (基本ハードフィルター: Stage 2 + RS>=80 + 売上+10%↑ + EPS+20%↑(または黒字転換))
      conditions.push('is_trend_template_pass = 1');
      conditions.push(`
        rs_rating >= 80 
        AND sales_yoy_pct >= 10.0 
        AND (eps_yoy_pct >= 20.0 OR growth_status = 'TURNAROUND')
      `);
    }

    // 時価総額・流動性は独立したオプショントグルとして重ね合わせ
    if (sweetSpotCap) {
      conditions.push('market_cap >= 100 AND market_cap <= 1000');
    }

    if (midLargeCap) {
      conditions.push('market_cap >= 300 AND market_cap <= 3000');
    }

    if (minLiquidity) {
      conditions.push('avg_trading_value_5d >= 1.0');
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1 = 1';

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
      pivot_price: 'pivot_price',
      pivot_distance_pct: 'pivot_distance_pct',
      dist_sma25_pct: 'dist_sma25_pct',
      dist_sma50_pct: 'dist_sma50_pct',
      pullback_depth_pct: 'pullback_depth_pct',
      min_vdu_ratio: 'min_vdu_ratio',
      atr_contraction_ratio: 'atr_contraction_ratio',
      volume_dryup_ratio: 'volume_dryup_ratio',
      rs_rating: 'rs_rating',
      market_cap: 'market_cap',
      funda_score: fundaScoreExpr,
    };

    const sortBy = searchParams.get('sort_by');
    const order = searchParams.get('order')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let orderSql = 'ORDER BY is_pivot_breakout DESC, is_near_pivot DESC, pivot_distance_pct DESC, rs_rating DESC';
    if (mode === 'stage2_pullback_25') {
      orderSql = 'ORDER BY rs_rating DESC, dist_sma25_pct ASC';
    } else if (mode === 'stage2_pullback_50') {
      orderSql = 'ORDER BY rs_rating DESC, dist_sma50_pct ASC';
    }

    if (sortBy && validSortColumns[sortBy]) {
      const col = validSortColumns[sortBy];
      if (sortBy === 'funda_score') {
        orderSql = `ORDER BY ${col} ${order}, rs_rating DESC`;
      } else {
        orderSql = `ORDER BY ${col} IS NULL ASC, ${col} ${order}`;
      }
    }

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
    console.error('SEPA VCP Candidates API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
