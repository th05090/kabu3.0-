import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const prompt = `「${query}」という株式テーマに関連する具体的な事業内容や関連キーワードを、日本語でカンマ区切りで10個挙げてください。解説は一切不要です。`;
    const model = 'gemma3:12b'; // We can make this configurable later if needed

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
          temperature: 0
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
