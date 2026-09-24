import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GICS_DICTIONARY } from '@/data/gics_dictionary';

export interface TempGicsStockItem {
  ticker: string;
  name: string;
  sub_industry_id: string;
  sub_industry_name: string;
  industry_id: string;
  industry_name: string;
  industry_group_id: string;
  industry_group_name: string;
  sector_id: string;
  sector_name: string;
  is_unclassified: boolean;
}

export async function GET() {
  try {
    const sql = `
      SELECT 
        s.ticker, 
        s.name, 
        COALESCE(m.gics_sub_industry_id, s.gics_sub_industry_id) as sub_id
      FROM stocks s
      LEFT JOIN equities_master m ON s.ticker = m.ticker
      ORDER BY s.ticker ASC
    `;

    const res = await db.execute(sql);

    const items: TempGicsStockItem[] = res.rows.map((row: any) => {
      const ticker = String(row.ticker || '');
      const name = String(row.name || '');
      const subId = String(row.sub_id || '').trim();
      const gics = subId ? GICS_DICTIONARY[subId] : null;

      if (gics) {
        return {
          ticker,
          name,
          sub_industry_id: subId,
          sub_industry_name: gics.sub_industry_name,
          industry_id: gics.industry_id,
          industry_name: gics.industry_name,
          industry_group_id: gics.industry_group_id,
          industry_group_name: gics.industry_group_name,
          sector_id: gics.sector_id,
          sector_name: gics.sector_name,
          is_unclassified: false,
        };
      }

      return {
        ticker,
        name,
        sub_industry_id: '',
        sub_industry_name: '未分類',
        industry_id: '999999',
        industry_name: '未分類',
        industry_group_id: '9999',
        industry_group_name: '未分類',
        sector_id: '99',
        sector_name: '未分類',
        is_unclassified: true,
      };
    });

    return NextResponse.json({
      success: true,
      total: items.length,
      items,
    });
  } catch (error: any) {
    console.error('Failed to fetch temp gics items:', error);
    return NextResponse.json(
      { error: 'GICSデータの取得に失敗しました', details: error?.message },
      { status: 500 }
    );
  }
}
