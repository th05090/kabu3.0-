const OLLAMA_URL = "http://localhost:11434/api/generate";

export async function askLLM(prompt: string, expectJson: boolean = false): Promise<string> {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma4:12b",
      prompt: prompt,
      stream: false,
      format: expectJson ? "json" : undefined,
      options: { temperature: 0.1, num_predict: 800 }
    })
  });
  if (!res.ok) {
    throw new Error(`LLM Error: ${res.statusText}`);
  }
  const jsonRes = await res.json();
  return jsonRes.response.trim();
}

export const pass1PromptTemplate = (pass1Text: string) => `あなたはデータ抽出アシスタントです。以下のテキストから、企業のセグメント別の売上高（または営業収益）を抽出し、以下のJSON形式で出力してください。
マークダウンで囲まないでください。JSONの値に改行を含めないでください。

[
  { "segment": "セグメント名", "revenue": "売上高数値（カンマなし半角数字）" }
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
3. 出力は以下のJSON形式のみとし、マークダウンで囲まないでください。JSONの値に改行を含めないでください。

{
  "segments": [
    { "segment": "セグメント名", "description": "事業内容の要約" }
  ]
}

【テキスト】
${pass2Text}`;

export const step2PromptTemplate = (
  companyName: string, 
  ticker5: string, 
  refInfo: string, 
  maxSegment: any, 
  otherSegments: any[]
) => `あなたはプロの証券アナリストです。以下の企業のセグメント別売上構成と参考情報を基に、この企業がどのようなビジネスを中核としているか、投資家向けに1文（30〜50文字程度）でわかりやすく要約してください。
※重要：テキストに記載のない推測や、企業名の直訳・妄想は絶対に禁止します。具体的な企業名を要約に含めることを禁止します。

【企業名】: ${companyName} (${ticker5})

${refInfo}
【売上が最大の主力セグメント】: ${maxSegment.segment}（${maxSegment.description}）
【その他の展開セグメント】:
${otherSegments.map((s: any) => `- ${s.segment}（${s.description}）`).join("\n")}

【思考のステップ】
必ず以下の順番で思考してください。
1. 上記の主力事業とその他事業の情報をスキャンし、中核事業を特定する。
2. 決して推測や関連用語からの類推を行わないこと。
3. 指定されたJSONフォーマットのみを出力して終了すること。

【出力形式】
以下のJSONフォーマットのみを出力してください。
{ "summary": "1文要約" }`;

export const unifiedPromptTemplate = (
  companyName: string, 
  ticker5: string, 
  shikihoSummary: string, 
  shikihoKeywords: string, 
  earningsText: string
) => `あなたはプロの証券アナリストです。以下の企業の「四季報プロフィール」と「有価証券報告書の事業内容テキスト」を総合的に判断し、この企業の中核事業を投資家向けに1文（30〜50文字程度）でわかりやすく要約してください。
※重要：テキストに記載のない推測や、企業名の直訳・妄想は絶対に禁止します。具体的な企業名を要約に含めることを禁止します。

【企業名】: ${companyName} (${ticker5})

【四季報プロフィール（参考）】
- 事業概要: ${shikihoSummary}
- キーワード: ${shikihoKeywords}

【有価証券報告書テキスト（抜粋）】
${earningsText}

【思考のステップ】
必ず以下の順番で思考してください。
1. テキスト全体を1度だけスキャンし、中核事業を特定する。
2. 決して推測や関連用語からの類推を行わないこと。
3. 指定されたJSONフォーマットのみを出力して終了すること。

【出力形式】
以下のJSONフォーマットのみを出力してください。
{ "summary": "1文要約" }`;
