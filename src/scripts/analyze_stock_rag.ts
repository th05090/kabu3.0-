import { promises as fs } from 'fs';
import path from 'path';
import { headerAwareChunker } from './rag/chunker';
import { initQdrant, indexChunks, retrieveHybrid, qdrant, COLLECTION_NAME } from './rag/qdrant';

const LLM_MODEL = "gemma3:12b";

// --- Step 1 Prompt ---
const STEP1_SYSTEM_PROMPT = `あなたは無機質なデータ転記ボットです。推論、要約、単位変換を一切行わず、提供されたテキストから事実のみを抽出してください。

【厳守事項】
1. 計算・四則演算の禁止: 数値はテキストにあるものをそのまま抽出すること。「足し算・引き算・パーセンテージ計算・金額単位変換」を絶対に行わないこと。
2. 事実のコピペに徹する：テキストに書かれていない単語は絶対に補完・捏造しないでください。
3. 対象データの限定：「連結（Consolidated）」の数値を優先し、「個別」は無視してください。
4. 出力はJSONのみ：以下のJSONスキーマの形式で出力し、マークダウンのコードブロック (\`\`\`json ... \`\`\`) で囲むこと。`;

const STEP2_SYSTEM_PROMPT = `あなたはプロの証券アナリストです。
提供された【抽出済み決算データ】のみを情報源として、最終的な決算アナリストレポートを作成してください。

【厳守事項】
1. 外部知識の完全遮断：提供されたデータ内に存在しないキーワードを勝手に生成しないでください。事実ベース以外の推測（ハルシネーション）は厳禁です。
2. アナリストのトーン：事実に忠実でありつつ、証券アナリストとしての専門的な語彙（モメンタム、損益分岐点、トップラインなど）を用いて、論理的でプロフェッショナルな文章に整えてください。
3. インプリケーション（示唆）の提示：'ai_comment'の項目では、提供された事実データから論理的に導き出せる「総合的な評価と今後の展望」を鋭く記述してください。
4. 全項目の統合出力：提供された3つのデータの内容を清書し、あなた自身の「ai_comment」を追加した4つの項目でJSONを出力してください。
5. 【重要】データ型の厳守：出力するJSONのすべての値（value）は、必ず「プレーンテキストの文字列（String）」にしてください。配列（Array）やオブジェクト（Object）を絶対に使用しないでください。すべての情報を文章として記述してください。`;

function formatJapaneseCurrency(text: string): string {
  // 123,456百万円 -> 1234億5600万円 などに置換する簡単な正規表現
  return text.replace(/([\d,]+)百万円/g, (match, p1) => {
    const num = parseInt(p1.replace(/,/g, ''), 10);
    if (isNaN(num)) return match;
    
    // 百万円単位の数値を円に直す ( * 1,000,000)
    let yen = BigInt(num) * BigInt(1000000);
    
    const cho = yen / BigInt(1000000000000);
    yen %= BigInt(1000000000000);
    
    const oku = yen / BigInt(100000000);
    yen %= BigInt(100000000);
    
    const man = yen / BigInt(10000);
    
    let res = '';
    if (cho > BigInt(0)) res += `${cho}兆`;
    if (oku > BigInt(0)) res += `${oku}億`;
    if (man > BigInt(0)) res += `${man}万`;
    if (res === '') return '0円';
    return res + '円';
  });
}

async function callOllama(system: string, prompt: string): Promise<string> {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      system: system,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        num_ctx: 32768
      }
    })
  });
  if (!res.ok) throw new Error(`Ollama API Error: ${await res.text()}`);
  const data = await res.json();
  let text = data.response;
  const match = text.match(/```json\n([\s\S]*?)\n```/);
  return match ? match[1] : text;
}

export async function generateAiReport(ticker: string, prevPdfPath: string, latestPdfPath: string, onProgress?: (msg: string) => void) {
  if (onProgress) onProgress(`[AI分析] ${ticker}のアナリストレポート生成を開始します...`);

  try {
    // ticker is passed directly now
    const prevMdPath = prevPdfPath.replace('.pdf', '.md');
    const latestMdPath = latestPdfPath.replace('.pdf', '.md');
    
    await initQdrant();

    console.log("Loading markdown files...");
    const prevMd = await fs.readFile(prevMdPath, "utf8");
    const latestMd = await fs.readFile(latestMdPath, "utf8");
    
    // Header-Aware Chunking (Avoids breaking tables and keeps sections grouped)
    const prevChunks = headerAwareChunker(prevMd, 2500);
    const latestChunks = headerAwareChunker(latestMd, 2500);
    
    // Cleanup old data for this ticker
    await qdrant.delete(COLLECTION_NAME, {
      filter: { must: [{ key: "ticker", match: { value: ticker } }] }
    });

    await indexChunks(prevChunks, "prev", ticker);
    await indexChunks(latestChunks, "latest", ticker);

    console.log("Retrieving highly relevant context via True Hybrid Search (RRF)...");
    if (onProgress) onProgress(`[AI分析] RRFハイブリッド検索で過去と最新の文脈を抽出中...`);
    
    const aspects = [
      { sem: "当期の実績 経営成績 営業収益 利益", kw: "経営成績" },
      { sem: "次期の業績見通し 予想 ガイダンス", kw: "見通し" },
      { sem: "対処すべき課題 経営戦略 注力テーマ", kw: "課題" },
      { sem: "事業等のリスク リスク要因", kw: "リスク" }
    ];

    let prevContextList: string[] = [];
    let latestContextList: string[] = [];

    for (const aspect of aspects) {
      const p = await retrieveHybrid(ticker, "prev", aspect.sem, aspect.kw, 5);
      const l = await retrieveHybrid(ticker, "latest", aspect.sem, aspect.kw, 5);
      prevContextList.push(...p);
      latestContextList.push(...l);
    }

    const prevContextText = Array.from(new Set(prevContextList)).join("\n\n---\n\n");
    const latestContextText = Array.from(new Set(latestContextList)).join("\n\n---\n\n");
    
    console.log(`[RAG Context Size] Prev: ${prevContextText.length} chars, Latest: ${latestContextText.length} chars`);

    // --- STEP 1: FACT EXTRACTION ---
    const step1Prompt = `以下の <前回決算資料_抽出結果> と <今回決算資料_抽出結果> の情報を元に、事実のみを抽出してください。

<前回決算資料_抽出結果>
${prevContextText}
</前回決算資料_抽出結果>

<今回決算資料_抽出結果>
${latestContextText}
</今回決算資料_抽出結果>

【出力JSONフォーマット】
\`\`\`json
{
  "current_performance": "当期実績の営業収益、営業利益などの数値と要因（テキストの記述をそのまま使用）",
  "future_guidance": "次期の業績見通し数値と前提条件（テキストの記述をそのまま使用）",
  "report_comparison": "前回資料と今回資料の「課題」「リスク要因」の具体的な記述の差分事実"
}
\`\`\`
`;

    console.log(`\n--- [Step 1] Asking ${LLM_MODEL} to extract facts ---`);
    if (onProgress) onProgress(`[AI分析: 1/2] 最新決算と過去決算の事実差分を抽出中 (LLM推論)...`);
    let start = Date.now();
    const step1Result = await callOllama(STEP1_SYSTEM_PROMPT, step1Prompt);
    console.log(`Step 1 Time: ${((Date.now() - start) / 1000).toFixed(2)}s`);
    
    // Save Step 1 result for debugging
    await fs.writeFile(path.join(__dirname, "..", "data", "step1_debug.json"), step1Result, "utf8");

    // Typescript side parsing/replacement
    let normalizedStep1Result = formatJapaneseCurrency(step1Result);
    
    // 12B model tends to lazy-copy JSON structures if the input is JSON.
    // Convert the extracted JSON into plain text sections.
    try {
      const parsed = JSON.parse(normalizedStep1Result);
      normalizedStep1Result = `
【当期業績の抽出データ】
${typeof parsed.current_performance === 'string' ? parsed.current_performance : JSON.stringify(parsed.current_performance, null, 2)}

【次期見通しの抽出データ】
${typeof parsed.future_guidance === 'string' ? parsed.future_guidance : JSON.stringify(parsed.future_guidance, null, 2)}

【前回資料比較の抽出データ】
${typeof parsed.report_comparison === 'string' ? parsed.report_comparison : JSON.stringify(parsed.report_comparison, null, 2)}
`;
    } catch (e) {
      console.log("Step 1 output was not valid JSON, passing as raw text.");
    }
    
    // --- STEP 2: ANALYST REFINEMENT ---
    const step2Prompt = `以下の【抽出済み決算データ】を元に、レポートを作成してください。

【抽出済み決算データ】
${normalizedStep1Result}

【出力JSONフォーマット】
\`\`\`json
{
  "current_performance": "提供されたデータを元に、アナリストのトーンで清書した当期業績",
  "future_guidance": "提供されたデータを元に、アナリストのトーンで清書した次期見通し",
  "report_comparison": "提供されたデータを元に、アナリストのトーンで清書した前回比較",
  "ai_comment": "抽出データから論理的に導き出せる、証券アナリストとしての総合的な評価と示唆 長く詳細に"
}
\`\`\`
`;

    console.log(`\n--- [Step 2] Asking ${LLM_MODEL} to generate analyst report ---`);
    if (onProgress) onProgress(`[AI分析: 2/2] アナリストレポートを生成中 (LLM推論)...`);
    start = Date.now();
    const step2Result = await callOllama(STEP2_SYSTEM_PROMPT, step2Prompt);
    console.log(`Step 2 Time: ${((Date.now() - start) / 1000).toFixed(2)}s`);

    const outPath = path.join(__dirname, "..", "data", `${ticker}_ai_report.json`);
    await fs.writeFile(outPath, step2Result, "utf8");
    console.log(`Saved final result to ${outPath}`);
    if (onProgress) onProgress(`[AI分析] レポート生成完了: ${outPath}`);
    return true;

  } catch (error: any) {
    console.error("Error during Hybrid RAG analysis:", error);
    if (onProgress) onProgress(`[AI分析エラー] ${error.message}`);
    return false;
  }
}

