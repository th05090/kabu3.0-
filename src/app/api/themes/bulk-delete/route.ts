import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { ids } = await request.json();
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Valid ids array is required' }, { status: 400 });
    }

    const placeholders = ids.map(() => '?').join(',');

    // Delete associated stocks first
    await db.execute({
      sql: `DELETE FROM custom_theme_stocks WHERE theme_id IN (${placeholders})`,
      args: ids
    });

    // Delete themes
    await db.execute({
      sql: `DELETE FROM custom_themes WHERE id IN (${placeholders})`,
      args: ids
    });

    return NextResponse.json({ success: true, deletedCount: ids.length });
  } catch (error: any) {
    console.error('Bulk delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
