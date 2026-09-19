import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { randomUUID } from 'crypto';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    // 高速チェックモード: 登録済みティッカー一覧のみを返却
    if (mode === 'tickers') {
      const res = await db.execute('SELECT ticker FROM watchlist_items ORDER BY created_at DESC');
      const tickers = res.rows.map((r) => r.ticker as string);
      return NextResponse.json({ tickers });
    }

    // 詳細一覧モード: stocks, sepa_metrics をJOINして最新指標を返却
    const query = `
      SELECT 
        w.id,
        w.ticker,
        w.source,
        w.added_price,
        w.added_date,
        w.notes,
        w.target_price,
        w.created_at,
        w.updated_at,
        s.name,
        s.market,
        s.industry,
        s.current_price,
        s.gics_sub_industry_id,
        s.revenue_growth_pct as sales_yoy_pct,
        s.eps_growth_pct as eps_yoy_pct,
        s.volume_ratio,
        m.is_trend_template_pass,
        m.is_pivot_breakout,
        m.growth_status,
        m.rs_rating,
        m.sma_50,
        m.sma_200,
        -- 前日比率（直近の2日quotesから算出、またはstocksから）
        (
          SELECT ((q1.adj_close - q2.adj_close) / q2.adj_close) * 100
          FROM daily_quotes q1
          JOIN daily_quotes q2 ON q1.ticker = q2.ticker AND q2.date < q1.date
          WHERE q1.ticker = w.ticker
          ORDER BY q1.date DESC, q2.date DESC
          LIMIT 1
        ) as daily_change_pct
      FROM watchlist_items w
      LEFT JOIN stocks s ON w.ticker = s.ticker
      LEFT JOIN sepa_metrics m ON w.ticker = m.ticker
      ORDER BY w.created_at DESC
    `;

    const res = await db.execute(query);

    const items = res.rows.map((row) => {
      const addedPrice = (row.added_price as number) || 1;
      const currentPrice = (row.current_price as number) || addedPrice;
      const sinceAddedPct = Math.round(((currentPrice - addedPrice) / addedPrice) * 1000) / 10;
      const dailyChangePct = row.daily_change_pct != null 
        ? Math.round((row.daily_change_pct as number) * 10) / 10 
        : 0;

      return {
        id: row.id,
        ticker: row.ticker,
        source: row.source,
        added_price: row.added_price,
        added_date: row.added_date,
        notes: row.notes,
        target_price: row.target_price,
        created_at: row.created_at,
        updated_at: row.updated_at,
        name: row.name || row.ticker,
        market: row.market || '',
        industry: row.industry || '',
        gics_sub_industry_id: row.gics_sub_industry_id,
        current_price: currentPrice,
        daily_change_pct: dailyChangePct,
        volume_ratio: row.volume_ratio != null ? Math.round((row.volume_ratio as number) * 100) / 100 : undefined,
        since_added_pct: sinceAddedPct,
        is_trend_template_pass: Boolean(row.is_trend_template_pass),
        is_pivot_breakout: Boolean(row.is_pivot_breakout),
        growth_status: row.growth_status as string | undefined,
        sales_yoy_pct: row.sales_yoy_pct as number | undefined,
        eps_yoy_pct: row.eps_yoy_pct as number | undefined,
        rs_rating: row.rs_rating as number | undefined,
        sma_50: row.sma_50 as number | undefined,
        sma_200: row.sma_200 as number | undefined,
      };
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('Failed to fetch watchlist:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch watchlist' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ticker, source = 'manual', notes = null, target_price = null } = body;

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    // 直近の終値・日付を取得
    const quoteRes = await db.execute({
      sql: 'SELECT adj_close, date FROM daily_quotes WHERE ticker = ? ORDER BY date DESC LIMIT 1',
      args: [ticker],
    });

    let currentPrice = 0;
    let addedDate = new Date().toISOString().split('T')[0];

    if (quoteRes.rows.length > 0) {
      currentPrice = (quoteRes.rows[0].adj_close as number) || 0;
      addedDate = (quoteRes.rows[0].date as string) || addedDate;
    } else {
      // stocks からのフォールバック
      const stockRes = await db.execute({
        sql: 'SELECT current_price FROM stocks WHERE ticker = ?',
        args: [ticker],
      });
      if (stockRes.rows.length > 0) {
        currentPrice = (stockRes.rows[0].current_price as number) || 0;
      }
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    await db.execute({
      sql: `
        INSERT INTO watchlist_items (id, ticker, source, added_price, added_date, notes, target_price, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ticker) DO UPDATE SET
          source = excluded.source,
          updated_at = excluded.updated_at
      `,
      args: [id, ticker, source, currentPrice, addedDate, notes, target_price, now, now],
    });

    return NextResponse.json({ 
      success: true, 
      item: { ticker, source, added_price: currentPrice, added_date: addedDate } 
    });
  } catch (error: any) {
    console.error('Failed to add to watchlist:', error);
    return NextResponse.json({ error: error?.message || 'Failed to add to watchlist' }, { status: 500 });
  }
}
