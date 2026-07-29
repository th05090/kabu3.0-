import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await db.execute({
      sql: 'SELECT * FROM custom_themes WHERE id = ?',
      args: [id]
    });
    
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Delete theme
    await db.execute({
      sql: 'DELETE FROM custom_themes WHERE id = ?',
      args: [id]
    });

    // Delete associated stocks
    await db.execute({
      sql: 'DELETE FROM custom_theme_stocks WHERE theme_id = ?',
      args: [id]
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
