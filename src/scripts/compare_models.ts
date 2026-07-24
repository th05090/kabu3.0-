import * as fs from 'fs/promises';
import * as path from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrant = new QdrantClient({ url: 'http://localhost:6333' });
const COLLECTION_NAME = 'earnings_reports';
const EMBEDDING_MODEL = 'bge-m3';

// Models to compare
const MODELS = ['qwen2.5:14b-instruct-q6_K', 'gemma3:12b'];

async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text })
  });
  const data = await response.json();
  return data.embedding;
}

async function searchRelevantChunks(ticker: string, period: string, query: string, limit = 5): Promise<string> {
  const queryVector = await getEmbedding(query);
  const searchResult = await qdrant.search(COLLECTION_NAME, {
    vector: queryVector,
    limit,
    filter: {
      must: [
        { key: 'ticker', match: { value: ticker } },
        { key: 'period', match: { value: period } }
      ]
    }
  });

  return searchResult.map(hit => {
    const payload = hit.payload as any;
    return `--- セクション: ${payload.h1} > ${payload.h2} > ${payload.h3} ---\n${payload.text}`;
  }).join('\n\n');
}

async function askModel(model: string, prompt: string): Promise<string> {
  console.log(`Asking ${model}...`);
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      prompt: prompt,
      stream: false,
      format: 'json', // Force JSON structure at API level
      options: {
        temperature: 0.1,
        num_ctx: 16384, // Ensure enough context for 2 periods
      }
    }),
  });
  if (!response.ok) {
    return `Error: ${response.statusText}`;
  }
  const data = await response.json();
  return data.response;
}

async function main() {
  const ticker = '7203';
  
  // Search BOTH periods
  const searchQuery = "当期の経営成績、次期の見通し、事業の状況、対処すべき課題、リスク";
  const contextPrev = await searchRelevantChunks(ticker, "prev", searchQuery, 5);
  const contextLatest = await searchRelevantChunks(ticker, "latest", searchQuery, 5);

  // Re-architect prompt: Context FIRST, strict instructions LAST (combat recency bias)
  const prompt = `以下は、トヨタ自動車（7203）の前回決算資料と今回決算資料の抜粋です。これらを比較分析してください。

【前回決算資料の抜粋】
${contextPrev}

==================================================

【今回決算資料の抜粋】
${contextLatest}

==================================================

あなたのミッションは、プロの証券アナリストとして機能することです。
提供された2つの決算資料テキストを比較・分析し、以下のJSONフォーマットで厳格に出力してください。
Markdownのコードブロックなどは不要です。純粋なJSON文字列のみを出力してください。

【厳守事項】
1. JSONの文字列値の中で「改行」は一切使用しないでください。
2. 箇条書きを出力したい場合は、改行の代わりに「・」で区切って1行の文字列として出力してください。
3. コンテキストに記載がない項目については、無理に推測せず「記載なし」と出力してください。
4. 【重要】「1行」とは改行を使わないという意味であり、文章を短くするという意味ではありません。文字数を惜しまず、可能な限り詳細な長文で記述してください。
5. 【重要】抽象的な表現（「売上高が増加」など）は禁止します。必ずコンテキストから具体的な数値（金額、％、増減幅など）を引用して根拠を提示してください。

【出力フォーマット】
{
  "strengths": "この企業の強みや好調な事業要因（数値を交えて詳細に）",
  "weaknesses": "懸念点・リスク・減益要因（数値を交えて詳細に）",
  "theme_changes": "成長テーマや経営方針の進捗状況（詳細に）",
  "important_changes": "前回資料と比較して「新たに強調されたリスク・方針」または「トーンダウンして消えた内容」（詳細に）",
  "ai_comment": "証券アナリストとしての総合的な評価と今後の展望（詳細に・改行なしの長文テキスト）"
}
`;

  let markdownOutput = `# 推論用モデル 比較レポート\n\n`;
  markdownOutput += `## 使用したプロンプト (システム指示 + RAG抽出コンテキスト)\n\`\`\`text\n${prompt}\n\`\`\`\n\n`;
  markdownOutput += `---\n\n`;

  for (const model of MODELS) {
    const startTime = Date.now();
    const result = await askModel(model, prompt);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    markdownOutput += `## モデル: ${model}\n`;
    markdownOutput += `- **推論時間**: ${duration} 秒\n\n`;
    markdownOutput += `### 回答 (JSON)\n\`\`\`json\n${result}\n\`\`\`\n\n`;
  }

  const outPath = path.join(process.cwd(), 'model_comparison.md');
  await fs.writeFile(outPath, markdownOutput, 'utf-8');
  console.log(`Comparison saved to ${outPath}`);
}

main();
