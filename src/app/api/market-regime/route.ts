import { NextResponse } from 'next/server';
import { calculateMarketRegime } from '@/features/market_regime/market_regime_calculator';

export async function GET() {
  try {
    const data = await calculateMarketRegime();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to calculate market regime:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to calculate market regime' },
      { status: 500 }
    );
  }
}
