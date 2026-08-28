import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const prompt = `あなたは日本株式市場のテーマ投資検索システム向けクエリ拡張AIです。
ユーザーから入力された投資テーマに対し、企業の事業説明文に実際に含まれる【具体的な要素技術、電子部品、インフラ、サプライチェーンの製品名】をカンマ区切りで5個だけ日本語で出力してください。

【絶対ルール】
1. 前置き、挨拶、解説、リスト番号などは絶対に含めないでください。単語とカンマのみを出力します。
2. 中国語や韓国語（ハングル）、不自然な英単語が混ざった造語（例: 팹리ケーター、フィギュrine 等）は厳禁です。必ず実在する自然な日本語（漢字・カタカナ・一般的なビジネス英略称）のみを使用してください。
3. 俗語やサブカル用語が入力された場合は、IR資料などで用いられる正式なビジネス用語・製品名に変換して抽出してください。

出力形式の例：
A, B, C, D, E

=== 例 ===
User: 脱炭素
Assistant: 再生可能エネルギー, 水素アンモニア, EV充電器, 排出権取引, 二酸化炭素回収

User: 半導体製造装置
Assistant: 露光装置, エッチング装置, ダイサー, ウェハ洗浄, テスタ

User: 推し活
Assistant: カプセルトイ, アミューズメント施設, アニメグッズ, キャラクターライセンス, フィギュア
=== 例はここまで ===

User: ${query}
Assistant:`;
    const model = 'qwen2.5:14b-instruct-q4_K_M';

    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_ctx: 2048
        }
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Ollama Error: ${res.status} ${res.statusText} - ${errorText}`);
      throw new Error('Failed to fetch from Ollama API');
    }

    const data = await res.json();
    let expandedKeywords = data.response || '';

    // Clean up the output (remove trailing dots, newlines, etc.)
    expandedKeywords = expandedKeywords.replace(/\n/g, '').trim();
    if (expandedKeywords.endsWith('。')) {
      expandedKeywords = expandedKeywords.slice(0, -1);
    }

    return NextResponse.json({ expandedKeywords });
  } catch (error: any) {
    console.error('Query expansion error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
