import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    
    let query = 'SELECT * FROM ir_news ORDER BY date DESC LIMIT 50';
    let args: any[] = [];
    
    if (ticker) {
      query = 'SELECT * FROM ir_news WHERE ticker = ? ORDER BY date DESC LIMIT 50';
      args.push(ticker);
    }
    
    const result = await db.execute({ sql: query, args });
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching ir_news:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
