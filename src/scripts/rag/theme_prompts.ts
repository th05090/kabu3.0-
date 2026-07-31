const OLLAMA_URL = "http://localhost:11434/api/generate";

export async function askLLM(prompt: string, expectJson: boolean = false): Promise<string> {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma3:12b",
      prompt: prompt,
      stream: false,
      format: expectJson ? "json" : undefined,
      options: { temperature: 0.1 }
    })
  });
  if (!res.ok) {
    throw new Error(`LLM Error: ${res.statusText}`);
  }
  const jsonRes = await res.json();
  return jsonRes.response.trim();
}

export const pass1PromptTemplate = (pass1Text: string) => `あなたはデータ抽出アシスタントです。以下の決算書のテキスト（主に表）から、各報告セグメントの名称と売上高を抽出してください。
【厳守事項】
1. 「計」「合計」「調整額」「全社」「内部売上高」「利益」などの計算用の行は絶対に除外してください。
2. 出力は以下のJSON配列のみとし、マークダウンのコードブロックで囲まないでください。

[
  { "segment": "セグメント名", "revenue": "売上高の文字列" }
]

【テキスト】
${pass1Text}`;

export const pass2PromptTemplate = (segmentNames: string[], pass2Text: string) => `あなたはデータ抽出アシスタントです。以下のテキストから、指定された各セグメントの事業内容（具体的な製品名、サービス名、対象顧客など）を抽出してください。
テキストに記載がない場合は「記載なし」としてください。

【対象セグメント】
${segmentNames.map((s) => `- ${s}`).join("\n")}

【厳守事項】
1. セグメント名をそのまま繰り返すのではなく、関連キーワード（製品名など）を必ず拾うこと。
2. 存在しない情報を勝手に推測したり捏造したりしないこと。
3. 出力は以下のJSON配列のみとし、マークダウンで囲まないでください。JSONの値に改行を含めないでください。

[
  { "segment": "セグメント名", "description": "事業内容の要約" }
]

【テキスト】
${pass2Text}`;

export const step2PromptTemplate = (
  companyName: string, 
  ticker5: string, 
  refInfo: string, 
  maxSegment: any, 
  otherSegments: any[]
) => `あなたはプロの証券アナリストです。以下の企業のセグメント別売上構成と参考情報を基に、この企業がどのようなビジネスを中核としているか、投資家向けに1文（30〜50文字程度）でわかりやすく要約してください。
※重要：テキストに記載のない用途や、企業名からの勝手な連想は絶対に禁止します。

【企業名】: ${companyName} (${ticker5})

${refInfo}
【売上が最大の主力セグメント】: ${maxSegment.segment}（${maxSegment.description}）
【その他の展開セグメント】:
${otherSegments.map((s: any) => `- ${s.segment}（${s.description}）`).join("\n")}

【出力形式】
事業要約: [1文要約]`;

export const unifiedPromptTemplate = (
  companyName: string, 
  ticker5: string, 
  shikihoSummary: string, 
  shikihoKeywords: string, 
  earningsText: string
) => `あなたはプロの証券アナリストです。以下の企業の「四季報プロフィール」と「有価証券報告書の事業内容テキスト」を総合的に判断し、この企業の中核事業を投資家向けに1文（30〜50文字程度）でわかりやすく要約してください。
※重要：テキストに記載のない用途や、企業名からの勝手な連想は絶対に禁止します。

【企業名】: ${companyName} (${ticker5})

【四季報プロフィール（参考）】
- 事業概要: ${shikihoSummary}
- キーワード: ${shikihoKeywords}

【有価証券報告書テキスト（抜粋）】
${earningsText}

【出力形式】
事業要約: [1文要約]`;
