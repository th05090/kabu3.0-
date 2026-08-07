import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runDocling(pdfPath: string, mdPath: string): Promise<void> {
  console.log(`Running Docling on ${pdfPath}...`);
  const { stdout, stderr } = await execAsync(`python src/scripts/pdf_to_md_docling.py "${pdfPath}" "${mdPath}"`);
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
}

async function analyzeStock(prevPdfPath: string, latestPdfPath: string) {
  try {
    const prevMdPath = prevPdfPath.replace('.pdf', '_docling.md');
    const latestMdPath = latestPdfPath.replace('.pdf', '_docling.md');

    // Step 1: PDF to MD using Docling (Python script with CUDA)
    await runDocling(prevPdfPath, prevMdPath);
    await runDocling(latestPdfPath, latestMdPath);

    // Step 2: Read Markdown and apply Context Separation (RAG)
    console.log("Reading Docling markdown files...");
    const prevMd = await fs.readFile(prevMdPath, "utf8");
    const latestMd = await fs.readFile(latestMdPath, "utf8");

    // We only take a portion of the files to avoid context limits if they are too large.
    // Docling outputs very dense tables, so we should take the first 30,000 chars of each.
    const prevTruncated = prevMd.slice(0, 30000);
    const latestTruncated = latestMd.slice(0, 30000);

    // Step 3: Format Prompt with the proven 4-axis + 7-rules logic
    const prompt = `あなたは金融・IR資料の専門解析AIです。
提供された2つの決算資料テキストを比較・分析し、以下のJSONフォーマットで厳格に出力してください。
Markdownのコードブロックなどは不要です。純粋なJSON文字列のみを出力してください。

【厳守事項】
1. JSONの文字列値の中で「改行」は一切使用しないでください。
2. 箇条書きを出力したい場合は、改行の代わりに「・」で区切って1行の文字列として出力してください。
3. コンテキストに記載がない項目については、無理に推測せず「記載なし」と出力してください。
4. 【重要】「1行」とは改行を使わないという意味であり、文章を短くするという意味ではありません。文字数を惜しまず、可能な限り詳細な長文で記述してください。
5. 【重要】抽象的な表現（「売上高が増加」など）は禁止します。必ずコンテキストから具体的な数値（金額、％、増減幅など）を引用して根拠を提示してください。
6. 【重要】金額は『兆・億・万』に勝手に変換せず、抽出元のテキスト（百万円単位など）のまま出力してください。
7. 【重要】AI自身による足し算・引き算などの計算は一切禁止します。コンテキストに記載されている数値のみをそのまま引用してください。
8. 【重要】自身の事前知識は一切使用せず、提供されたテキスト内に存在する言葉のみを使用して比較・評価を行ってください。

【出力フォーマット】
{
  "current_performance": "【今回決算資料】のみに基づいて、当期実績の評価（強みと弱み・好調な要因と懸念点を統合し、数値を交えて詳細に）",
  "future_guidance": "【今回決算資料】のみに基づいて、次期業績見通し（次期の予想数値、今後の経営課題、未来へのリスク要因などを詳細に）",
  "report_comparison": "【前回決算資料】と【今回決算資料】の文章を読み比べ、経営課題、注力テーマ、リスク要因（関税影響など）に関する定性的なトーン変化や記述の差分のみを文章で抽出してください。※この項目では金額や数値の記載を一切行わないでください。",
  "ai_comment": "証券アナリストとしての総合的な評価と今後の展望（詳細に・改行なしの長文テキスト）"
}`;

    const context = `
==================================================
【前回決算資料の抜粋】
${prevTruncated}

==================================================
【今回決算資料の抜粋】
${latestTruncated}

==================================================
${prompt}
`;

    const modelName = process.argv[4] || 'gemma4:12b';
    // Step 4: Ask LLM
    console.log(`Asking ${modelName}...`);
    const t0 = Date.now();
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: context,
        stream: false,
        options: {
          temperature: 0.1,
          num_ctx: 32768,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${await response.text()}`);
    }

    const data = await response.json();
    const time = ((Date.now() - t0) / 1000).toFixed(2);
    
    console.log(`\n--- Result (${time}s) ---`);
    // Clean up potential markdown blocks if the LLM ignores the rule
    let cleanedResponse = data.response.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    
    // Save output
    const outputFilename = path.join(process.cwd(), 'src', 'data', 'toyota_ai_report.json');
    await fs.writeFile(outputFilename, cleanedResponse, "utf8");
    console.log(`Saved result to ${outputFilename}`);

  } catch (err: any) {
    console.error("Error during analysis:", err.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: npx tsx src/scripts/analyze_stock.ts <previous_pdf_path> <latest_pdf_path>");
    process.exit(1);
  }
  
  const prevPdf = args[0];
  const latestPdf = args[1];
  
  await analyzeStock(prevPdf, latestPdf);
}

main().catch(console.error);
