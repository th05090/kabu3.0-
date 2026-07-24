import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

async function extractImagesFromPdf(pdfPath: string): Promise<string[]> {
  console.log(`[1] Converting PDF to images via Python PyMuPDF...`);
  const pyScript = path.join(process.cwd(), 'src', 'scripts', 'pdf_to_images.py');
  
  try {
    // Increase maxBuffer to 50MB because base64 strings of multiple PDF pages can be large
    const { stdout } = await execAsync(`python "${pyScript}" "${pdfPath}"`, { maxBuffer: 50 * 1024 * 1024 });
    const result = JSON.parse(stdout);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    console.log(`Successfully extracted ${result.images.length} pages as images.`);
    return result.images;
  } catch (error: any) {
    throw new Error(`Failed to extract images from PDF: ${error.message}`);
  }
}

async function convertImagesToMarkdownWithOllama(images: string[], ticker: string): Promise<string> {
  console.log(`[2] Sending ${images.length} images to Ollama (qwen2.5vl:latest) sequentially to avoid context overflow...`);
  
  const prompt = `あなたは金融・IR資料の専門解析AIです。
提供された決算説明資料のスライド画像から、記載されているテキストや表の情報をMarkdown形式で完全に書き起こしてください。
【厳守事項】
1. **数値の厳密性**: 業績数字（売上、利益など）、パーセンテージ（%、増減率）、日付、年などは**絶対に一文字も間違えず、そのまま**書き起こすこと。LLMの推測で数値を補完したり丸めたりすることは絶対に禁止します。
2. 表がある場合は、Markdownのテーブル記法で整理して出力すること。
3. 箇条書きや強調（太字）などのレイアウト情報も可能な限りMarkdownで再現すること。
4. 画像内のテキストのみを出力し、あなたの感想や挨拶は一切含めないこと。`;

  let fullMarkdown = '';

  for (let i = 0; i < images.length; i++) {
    console.log(`  -> Processing page ${i + 1}/${images.length}...`);
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen2.5vl:latest',
        prompt: prompt,
        images: [images[i]],
        stream: false,
        options: {
          num_predict: 4000, 
          num_ctx: 8192,
          temperature: 0.1,
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama API error on page ${i + 1}: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    fullMarkdown += `\n\n<!-- PAGE ${i + 1} -->\n\n` + data.response;
  }

  return fullMarkdown;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npx tsx src/scripts/pdf_to_md.ts <ticker> [suffix]");
    process.exit(1);
  }
  
  const ticker = args[0];
  const suffix = args[1] || 'latest';
  const pdfPath = path.join(process.cwd(), 'data', 'pdfs', `${ticker}_${suffix}.pdf`);
  const mdDir = path.join(process.cwd(), 'data', 'md');
  const mdPath = path.join(mdDir, `${ticker}_${suffix}.md`);

  try {
    // Check if PDF exists
    await fs.access(pdfPath);
  } catch {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  try {
    // 1. PDF -> Base64 Images
    const base64Images = await extractImagesFromPdf(pdfPath);

    // 2. Base64 Images -> Markdown via Ollama Vision
    const markdown = await convertImagesToMarkdownWithOllama(base64Images, ticker);

    // 3. Save Markdown
    await fs.mkdir(mdDir, { recursive: true });
    await fs.writeFile(mdPath, markdown, 'utf-8');
    
    console.log(`[3] Success! Markdown saved to: ${mdPath}`);

  } catch (error: any) {
    console.error(`Error processing ${ticker}:`, error.message);
  }
}

main();
