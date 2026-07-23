import { NextResponse } from 'next/server';
import { syncJQuants } from '@/lib/jquants';

export async function POST() {
  try {
    // 実際の実装では非同期でバッチ処理をキックしてすぐレスポンスを返すか、
    // Vercel等のタイムアウトを考慮してキューイングする仕組みが必要ですが、
    // 今回はローカル実行・検証用として直接 await で実行します。
    
    // 現在は最新の1ファイルのみ取得するため数秒で完了します。
    const result = await syncJQuants();

    if (result.success) {
      return NextResponse.json({ message: 'Sync completed successfully' });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
