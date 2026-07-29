import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get all custom themes
export async function GET() {
  try {
    const res = await db.execute('SELECT * FROM custom_themes ORDER BY created_at DESC');
    
    // Fetch counts for each theme
    const countRes = await db.execute('SELECT theme_id, COUNT(*) as stock_count FROM custom_theme_stocks GROUP BY theme_id');
    const countMap = new Map();
    countRes.rows.forEach(r => countMap.set(r.theme_id, r.stock_count));

    const themes = res.rows.map(row => ({
      ...row,
      stock_count: countMap.get(row.id) || 0
    }));

    return NextResponse.json(themes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create a new custom theme
export async function POST(request: Request) {
  try {
    const { name, tickers } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute({
      sql: 'INSERT INTO custom_themes (id, name, created_at) VALUES (?, ?, ?)',
      args: [id, name, now]
    });

    if (tickers && Array.isArray(tickers) && tickers.length > 0) {
      // Insert stocks
      for (const ticker of tickers) {
        await db.execute({
          sql: 'INSERT INTO custom_theme_stocks (theme_id, ticker, similarity_score) VALUES (?, ?, ?)',
          args: [id, ticker, 1.0] // Default score for manually added stocks
        });
      }
    }

    return NextResponse.json({ id, name, created_at: now, stock_count: tickers?.length || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
