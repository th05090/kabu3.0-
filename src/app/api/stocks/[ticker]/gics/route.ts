import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GICS_DICTIONARY } from '@/data/gics_dictionary';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const body = await request.json();
    const subIndustryId = String(body.subIndustryId || '').trim();

    if (!subIndustryId) {
      return NextResponse.json({ error: 'GICS細分類コードを指定してください' }, { status: 400 });
    }

    const gicsInfo = GICS_DICTIONARY[subIndustryId];
    if (!gicsInfo) {
      return NextResponse.json(
        { error: `無効なGICS細分類コードです: ${subIndustryId}` },
        { status: 400 }
      );
    }

    const baseTicker = ticker.length > 4 ? ticker.slice(0, 4) : ticker;
    const fullTicker = ticker.length === 4 ? `${ticker}0` : ticker;

    // 1. equities_master の更新 (細分類、主幹テーマ/大分類名、監査OK、手動選択理由)
    await db.execute({
      sql: `
        UPDATE equities_master
        SET gics_sub_industry_id = ?,
            theme = ?,
            gics_audit_status = 'OK',
            gics_audit_reason = 'ユーザー手動選択'
        WHERE ticker = ? OR ticker = ? OR ticker = ?
      `,
      args: [subIndustryId, gicsInfo.sector_name, ticker, baseTicker, fullTicker],
    });

    // 2. stocks の更新
    await db.execute({
      sql: `
        UPDATE stocks
        SET gics_sub_industry_id = ?
        WHERE ticker = ? OR ticker = ? OR ticker = ?
      `,
      args: [subIndustryId, ticker, baseTicker, fullTicker],
    });

    // 3. sepa_metrics の更新
    await db.execute({
      sql: `
        UPDATE sepa_metrics
        SET gics_sub_industry_id = ?
        WHERE ticker = ? OR ticker = ? OR ticker = ?
      `,
      args: [subIndustryId, ticker, baseTicker, fullTicker],
    });

    return NextResponse.json({
      success: true,
      gics: {
        sub_industry_id: subIndustryId,
        sub_industry_name: gicsInfo.sub_industry_name,
        industry_id: gicsInfo.industry_id,
        industry_name: gicsInfo.industry_name,
        industry_group_id: gicsInfo.industry_group_id,
        industry_group_name: gicsInfo.industry_group_name,
        sector_id: gicsInfo.sector_id,
        sector_name: gicsInfo.sector_name,
      },
    });
  } catch (error: any) {
    console.error('Failed to update GICS classification:', error);
    return NextResponse.json(
      { error: 'GICS分類の更新に失敗しました', details: error?.message },
      { status: 500 }
    );
  }
}
