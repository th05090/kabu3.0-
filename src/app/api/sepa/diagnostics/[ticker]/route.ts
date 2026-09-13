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

    const q = decodeURIComponent(ticker).trim();
    const q5 = q.length === 4 ? `${q}0` : q;
    const q4 = q.length === 5 && q.endsWith('0') ? q.slice(0, 4) : q;

    // 1. SEPAメトリクス取得 (4桁コード、5桁コード、銘柄名検索に対応)
    const sepaRes = await db.execute({
      sql: `
        SELECT * FROM sepa_metrics 
        WHERE ticker = ? 
           OR ticker = ? 
           OR ticker = ? 
           OR ticker LIKE ?
           OR name = ?
           OR name LIKE ?
        ORDER BY 
          CASE 
            WHEN ticker = ? THEN 1
            WHEN ticker = ? THEN 2
            WHEN ticker LIKE ? THEN 3
            WHEN name = ? THEN 4
            WHEN name LIKE ? THEN 5
            ELSE 6
          END
        LIMIT 1
      `,
      args: [q5, q, q4, `${q}%`, q, `%${q}%`, q5, q, `${q}%`, q, `${q}%`]
    });
    const sepa = sepaRes.rows[0];
    if (!sepa) {
      return NextResponse.json({ success: false, error: 'Stock not found in SEPA metrics' }, { status: 404 });
    }

    const canonicalTicker = String(sepa.ticker);
    const baseTicker = canonicalTicker.length === 5 && canonicalTicker.endsWith('0')
      ? canonicalTicker.slice(0, 4)
      : canonicalTicker;

    // 2. 日足データ (直近260営業日: 最新から260日分を取得し日付昇順で返却)
    const quotesRes = await db.execute({
      sql: `SELECT * FROM (
              SELECT date, adj_open as open, adj_high as high, adj_low as low, adj_close as close, adj_volume as volume
              FROM daily_quotes 
              WHERE ticker = ? OR ticker = ?
              ORDER BY date DESC 
              LIMIT 260
            ) ORDER BY date ASC`,
      args: [canonicalTicker, baseTicker]
    });

    // 3. 関連する新規事業IRニュース (カタリスト)
    const irRes = await db.execute({
      sql: `SELECT id, title, date, pdf_path FROM ir_news WHERE ticker = ? OR ticker = ? ORDER BY date DESC LIMIT 10`,
      args: [canonicalTicker, baseTicker]
    });

    // 4. 四半期財務履歴 (直近8四半期)
    const finRes = await db.execute({
      sql: `SELECT date, net_sales, operating_profit, ordinary_profit, profit, adj_eps
            FROM financials 
            WHERE ticker = ? OR ticker = ?
            ORDER BY date DESC 
            LIMIT 8`,
      args: [canonicalTicker, baseTicker]
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
