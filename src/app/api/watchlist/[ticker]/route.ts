import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

interface RouteParams {
  params: Promise<{ ticker: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { ticker } = await params;
    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    await db.execute({
      sql: 'DELETE FROM watchlist_items WHERE ticker = ?',
      args: [ticker],
    });

    return NextResponse.json({ success: true, ticker });
  } catch (error: any) {
    console.error('Failed to remove from watchlist:', error);
    return NextResponse.json({ error: error?.message || 'Failed to remove from watchlist' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { ticker } = await params;
    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    const body = await request.json();
    const { notes, target_price } = body;
    const now = new Date().toISOString();

    const updates: string[] = ['updated_at = ?'];
    const args: any[] = [now];

    if (notes !== undefined) {
      updates.push('notes = ?');
      args.push(notes);
    }
    if (target_price !== undefined) {
      updates.push('target_price = ?');
      args.push(target_price);
    }

    args.push(ticker);

    await db.execute({
      sql: `UPDATE watchlist_items SET ${updates.join(', ')} WHERE ticker = ?`,
      args,
    });

    return NextResponse.json({ success: true, ticker });
  } catch (error: any) {
    console.error('Failed to update watchlist item:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update watchlist item' }, { status: 500 });
  }
}
