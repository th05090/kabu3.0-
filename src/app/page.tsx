import { db } from '@/lib/db';
import { StockTable, StockRow } from '@/features/screener/components/StockTable';
import { StockFilter } from '@/features/screener/components/StockFilter';
import Link from 'next/link';

export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const page = parseInt((params.page as string) || '1', 10);
  const limit = 100;
  const offset = (page - 1) * limit;

  // Build dynamic WHERE clause based on filters
  let whereClauses: string[] = [];
  let queryArgs: any[] = [];

  if (params.ticker) {
    whereClauses.push('ticker LIKE ?');
    queryArgs.push(`%${params.ticker}%`);
  }
  if (params.name) {
    whereClauses.push('name LIKE ?');
    queryArgs.push(`%${params.name}%`);
  }
  if (params.industry) {
    whereClauses.push('industry LIKE ?');
    queryArgs.push(`%${params.industry}%`);
  }
  if (params.gics_sub_industry) {
    whereClauses.push('gics_sub_industry_id = ?');
    queryArgs.push(params.gics_sub_industry);
  }
  if (params.market) {
    whereClauses.push('market = ?');
    queryArgs.push(params.market);
  }
  if (params.perfect_order === '1') whereClauses.push('is_perfect_order = 1');
  if (params.above_sma25 === '1') whereClauses.push('is_above_sma_25 = 1');
  if (params.above_sma75 === '1') whereClauses.push('is_above_sma_75 = 1');
  if (params.above_sma200 === '1') whereClauses.push('is_above_sma_200 = 1');
  if (params.golden_cross === '1') whereClauses.push('is_golden_cross = 1');
  
  // ブレイク
  if (params.high_20d_update === '1') whereClauses.push('is_high_20d_update = 1');
  if (params.high_60d_update === '1') whereClauses.push('is_high_60d_update = 1');
  if (params.high_52w_update === '1') {
    whereClauses.push('high_52w_deviation >= 0'); // 当日高値 >= 52週高値
  }
  
  // モメンタム
  if (params.rsi_min) { whereClauses.push('rsi >= ?'); queryArgs.push(Number(params.rsi_min)); }
  if (params.rsi_max) { whereClauses.push('rsi <= ?'); queryArgs.push(Number(params.rsi_max)); }
  if (params.roc_min) { whereClauses.push('roc >= ?'); queryArgs.push(Number(params.roc_min)); }
  if (params.roc_max) { whereClauses.push('roc <= ?'); queryArgs.push(Number(params.roc_max)); }
  if (params.return_5d_min) { whereClauses.push('return_5d_pct >= ?'); queryArgs.push(Number(params.return_5d_min)); }
  if (params.return_20d_min) { whereClauses.push('return_20d_pct >= ?'); queryArgs.push(Number(params.return_20d_min)); }

  // 出来高・売買代金
  if (params.volume_ratio_min) {
    whereClauses.push('volume_ratio >= ?');
    queryArgs.push(Number(params.volume_ratio_min));
  }
  if (params.trading_value_min) {
    whereClauses.push('avg_trading_value_5d >= ?');
    queryArgs.push(Number(params.trading_value_min));
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // ----------------------------------------------------
  // ソート (Sort)
  // ----------------------------------------------------
  const validSortColumns = [
    'ticker', 'market_cap', 'avg_trading_value_5d', 'revenue_growth_pct', 
    'operating_profit_growth_pct', 'operating_margin_pct', 'eps_growth_pct', 
    'equity_ratio_pct', 'dividend_yield_pct', 'sma_25_deviation_pct', 
    'distance_to_high_52w_pct', 'current_price', 'rsi', 'roc', 
    'return_5d_pct', 'return_20d_pct', 'volume_ratio', 'trading_value_ratio',
    'is_above_sma_25', 'is_above_sma_75', 'is_above_sma_200', 'is_perfect_order',
    'is_golden_cross', 'is_high_52w_update', 'is_high_20d_update', 'is_high_60d_update',
    'forecast_achievement_pct', 'earnings_reaction_pct', 'post_earnings_rise_pct',
    'drop_from_post_earnings_high_pct', 'days_since_earnings', 'remaining_business_days',
    'earnings_date', 'next_earnings_date_prediction', 'long_term_trend'
  ];
  const sortField = params.sort as string;
  const sortOrder = params.order === 'asc' ? 'ASC' : 'DESC';
  
  let orderSql = 'ORDER BY market_cap IS NULL ASC, market_cap DESC'; // Default
  if (sortField && validSortColumns.includes(sortField)) {
    // NULL値を常に下に配置する小技 (IS NULL ASC)
    orderSql = `ORDER BY ${sortField} IS NULL ASC, ${sortField} ${sortOrder}`;
  }

  let stocks: StockRow[] = [];
  let totalCount = 0;

  try {
    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as count FROM stocks ${whereSql}`,
      args: queryArgs
    });
    totalCount = countResult.rows[0].count as number;

    const result = await db.execute({
      sql: `SELECT * FROM stocks ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
      args: [...queryArgs, limit, offset]
    });
    stocks = JSON.parse(JSON.stringify(result.rows));
  } catch (error) {
    console.error('Failed to fetch stocks', error);
  }

  const totalPages = Math.ceil(totalCount / limit);

  const buildPageUrl = (p: number) => {
    // Record<string, string>にキャストしてURLSearchParamsを構築
    const filteredParams: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        filteredParams[k] = String(v);
      }
    }
    const sp = new URLSearchParams(filteredParams);
    sp.set('page', p.toString());
    return `/?${sp.toString()}`;
  };

  return (
    <main className="page-main">
      {/* 将来的に左側にグローバルメニューが入る想定 */}
      
      <div className="screener-content-wrapper">
        <header className="page-header">
          <h1>kabu3.0 - スクリーナー</h1>
        </header>

        {/* フィルタは上部に配置 */}
        <section className="screener-top-filter">
          <details className="filter-details">
            <summary>絞り込みフィルターを表示</summary>
            <div className="filter-content-wrapper">
              <StockFilter />
            </div>
          </details>
        </section>
        
        <section className="screener-table-section">
          <StockTable data={stocks} />
        </section>

        <section className="pagination-controls">
          <div className="pagination-info">
            全 {totalCount} 件中 {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} 件目を表示
          </div>
          <div className="pagination-buttons">
            {page > 1 && (
              <Link href={buildPageUrl(page - 1)} className="btn">前へ</Link>
            )}
            <span className="page-num">{page} / {totalPages || 1}</span>
            {page < totalPages && (
              <Link href={buildPageUrl(page + 1)} className="btn">次へ</Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
