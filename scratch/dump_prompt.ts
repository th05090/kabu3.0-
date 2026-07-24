import { promises as fs } from 'fs';
import path from 'path';
import { retrieveHybrid } from '../src/scripts/rag/qdrant';

const SYSTEM_PROMPT = `あなたはプロの証券アナリストです。
以下の【前提条件】と【厳守事項】を完全に守り、指定されたJSONフォーマットのみを出力してください。

【前提条件】
与えられた <前回決算資料_抽出結果> と <今回決算資料_抽出結果> のXMLタグ内に記載された情報のみを情報源とし、トヨタ自動車（7203）の決算分析を行ってください。

【厳守事項】
1. 完全な事実ベース: 提供されたテキストに記載されていない情報は一切生成しないでください（ハルシネーション禁止）。必ず指定されたXMLタグ内の情報のみを元に作成すること。自身の事前知識は一切使用せず、提供されたテキスト内に存在する言葉のみを使用して比較すること。
2. 計算・四則演算の禁止: 数値はテキストにあるものをそのまま抽出し、AI自身で「足し算・引き算・パーセンテージ計算・単位変換（百万円から億円など）」を絶対に行わないでください。
3. 推測の排除: 「〜と推測される」「〜と思われる」等の表現は使わず、資料に明記されている事実のみを記載してください。
4. トーンの差異抽出: 比較項目では、前回資料から今回資料にかけての「経営課題」「注力テーマ」「リスク要因」に関する定性的な記述のトーンの変化（ポジティブ化、ネガティブ化、具体化など）を抽出してください。
5. 出力はJSONのみ: 以下に示すJSONスキーマの形式で出力し、マークダウンのコードブロック (\`\`\`json ... \`\`\`) で囲んでください。
6. JSONキーの厳守: current_performance, future_guidance, report_comparison, ai_comment の4つのキーを必ず含めてください。
7. 文字数制限: 各項目のテキストは300文字〜500文字程度で、要点を絞って論理的に記述してください。

【出力JSONフォーマット】
\`\`\`json
{
  "current_performance": "今回決算資料における当期業績のサマリー（強みと懸念点）",
  "future_guidance": "今回決算資料における次期の見通しとリスク要因",
  "report_comparison": "前回資料と今回資料の比較における、経営課題や注力テーマに関する定性的なトーンの変化（数字は使用せず、文脈の変化に注力）",
  "ai_comment": "証券アナリストとしての総合的な評価と今後の展望"
}
\`\`\`
`;

async function dump() {
  const ticker = '7203';
  const aspects = [
    { sem: "当期の実績 経営成績 営業収益 利益", kw: "経営成績" },
    { sem: "次期の業績見通し 予想 ガイダンス", kw: "見通し" },
    { sem: "対処すべき課題 経営戦略 注力テーマ", kw: "課題" },
    { sem: "事業等のリスク リスク要因", kw: "リスク" }
  ];

  let prevContextList: string[] = [];
  let latestContextList: string[] = [];

  for (const aspect of aspects) {
    const p = await retrieveHybrid(ticker, "prev", aspect.sem, aspect.kw, 3);
    const l = await retrieveHybrid(ticker, "latest", aspect.sem, aspect.kw, 3);
    prevContextList.push(...p);
    latestContextList.push(...l);
  }

  const prevContexts = Array.from(new Set(prevContextList));
  const latestContexts = Array.from(new Set(latestContextList));
  
  const prevContextText = prevContexts.join("\n\n---\n\n");
  const latestContextText = latestContexts.join("\n\n---\n\n");

  const userPrompt = `必ず以下の指定されたXMLタグ内の情報のみを元に、それぞれの項目を作成してください。

<前回決算資料_抽出結果>
${prevContextText}
</前回決算資料_抽出結果>

<今回決算資料_抽出結果>
${latestContextText}
</今回決算資料_抽出結果>
`;

  const fullPrompt = "====== SYSTEM PROMPT ======\n" +
SYSTEM_PROMPT + "\n\n====== USER PROMPT ======\n" + userPrompt;

  await fs.writeFile(path.join(__dirname, 'prompt_dump.txt'), fullPrompt, 'utf8');
  console.log("Dumped to prompt_dump.txt");
}

dump();
