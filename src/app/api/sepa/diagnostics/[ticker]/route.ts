import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    if (!ticker) {
      return NextResponse.json({ success: false, error: 'Ticker is required' }, { status: 400 });
    }

    // 1. SEPAメトリクス取得
    const sepaRes = await db.execute({
      sql: `SELECT * FROM sepa_metrics WHERE ticker = ?`,
      args: [ticker]
    });
    const sepa = sepaRes.rows[0];
    if (!sepa) {
      return NextResponse.json({ success: false, error: 'Stock not found in SEPA metrics' }, { status: 404 });
    }

    // 2. 日足データ (直近260営業日: 最新から260日分を取得し日付昇順で返却)
    const quotesRes = await db.execute({
      sql: `SELECT * FROM (
              SELECT date, adj_open as open, adj_high as high, adj_low as low, adj_close as close, adj_volume as volume
              FROM daily_quotes 
              WHERE ticker = ? 
              ORDER BY date DESC 
              LIMIT 260
            ) ORDER BY date ASC`,
      args: [ticker]
    });

    // 3. 関連する新規事業IRニュース (カタリスト)
    const irRes = await db.execute({
      sql: `SELECT id, title, date, pdf_path FROM ir_news WHERE ticker = ? ORDER BY date DESC LIMIT 10`,
      args: [ticker]
    });

    // 4. 四半期財務履歴 (直近8四半期)
    const finRes = await db.execute({
      sql: `SELECT date, net_sales, operating_profit, ordinary_profit, profit, adj_eps
            FROM financials 
            WHERE ticker = ? 
            ORDER BY date DESC 
            LIMIT 8`,
      args: [ticker]
    });

    return NextResponse.json({
      success: true,
      data: {
        metrics: sepa,
        quotes: quotesRes.rows,
        irNews: irRes.rows,
        financials: finRes.rows
      }
    });
  } catch (error: any) {
    console.error('SEPA Diagnostics API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
