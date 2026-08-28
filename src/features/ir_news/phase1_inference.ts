import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { askLLM } from '../../scripts/rag/theme_prompts';
import { Client } from '@libsql/client';

const execAsync = promisify(exec);
const LLM_MODEL = "gemma4:12b";

export const IR_NEWS_PROMPT = `
あなたは企業のIR資料（適時開示）から、ベクトル検索データベースのインデックス構築に最適なメタデータを抽出・生成する専門のAIアシスタントです。

以下の【PDF資料】は、ある企業が発表した「新規事業」等に関するPDF資料から抽出されたテキストです。
この情報をベクトル検索で高精度にヒットさせるために、テキストの内容を分析し、以下の【抽出カテゴリ】に従ってキーワードおよび短いフレーズを出力してください。

【抽出カテゴリ】
1. business_domain (事業領域・業界): 
   - 該当する業界、市場、セクター（例：フィンテック、医療AI、M&A仲介など）
2. core_technology_model (コア技術・ビジネスモデル): 
   - 使用されている技術や提供形態（例：SaaS、LLM、ブロックチェーン、サブスクリプション、PoCなど）
3. target_and_problem (ターゲット・解決する課題): 
   - 誰向けのサービスか、何を解決するか（例：製造業の人手不足解消、バックオフィスのDX推進など）
4. search_synonyms (検索用類義語・関連語): 
   - 入力テキストに直接記載されていなくても、検索者が入力しそうな類義語、関連する抽象概念、トレンドワードをLLMの知識を用いて3〜5つ補完してください。

【制約事項】
・単なる単語だけでなく、ベクトル空間で意味を捉えやすい「短いフレーズ（名詞句）」も含めること。
・出力は必ず以下のJSONスキーマに従い、JSONコードブロックのみを出力すること。余計な解説は不要です。

【出力JSONフォーマット】
{
  "business_domain": ["...", "..."],
  "core_technology_model": ["...", "..."],
  "target_and_problem": ["...", "..."],
  "search_synonyms": ["...", "..."]
}
`;

export async function waitForVram(minFreeGb: number = 3.0, maxWaitMs: number = 30000): Promise<void> {
  const start = Date.now();
  console.log(`[VRAM Check] Waiting for at least ${minFreeGb}GB free VRAM...`);
  
  while (Date.now() - start < maxWaitMs) {
    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits');
      const freeMb = parseInt(stdout.trim());
      if (freeMb >= minFreeGb * 1024) {
        console.log(`[VRAM Check] OK: ${freeMb} MB free.`);
        return;
      }
      console.log(`[VRAM Check] Only ${freeMb} MB free, waiting...`);
    } catch (e) {
      console.log(`[VRAM Check] nvidia-smi failed, skipping check.`);
      return;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`[VRAM Check] Timed out waiting for VRAM. Proceeding anyway.`);
}

export interface ParsedResult {
  row: any;
  analysisText: string;
  newsId: string;
  ticker: string;
  title: string;
}

export async function runPhase1Inference(rows: any[], onProgress?: (msg: string) => void): Promise<ParsedResult[]> {
  console.log("\n=== Phase 1: LLM Inference ===");
  
  // Unload embedding model to free VRAM for LLM
  try {
    await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "bge-m3", keep_alive: 0 })
    });
  } catch(e) {}

  const parsedResults: ParsedResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ticker = String(row.ticker);
    const pdfPath = String(row.pdf_path);
    const newsId = String(row.id);
    const title = String(row.title);
    const mdPath = pdfPath.replace(/\.pdf$/i, '.md');

    console.log(`\n[Phase 1: ${i + 1}/${rows.length}] Analyzing IR News: ${ticker} - ${title}`);
    if (onProgress) onProgress(`[Phase1: ${i + 1}/${rows.length}] 抽出中: ${ticker} (${title})`);

    // 1. Docling MD Conversion
    if (!existsSync(mdPath)) {
      await waitForVram(3.0);
      try {
        console.log(`  => Running Docling on PDF...`);
        const pPath = path.resolve(process.cwd(), "src/scripts/pdf_to_md_docling.py");
        const pdfAbs = path.resolve(pdfPath);
        const mdAbs = path.resolve(mdPath);
        
        await execAsync(`python "${pPath}" "${pdfAbs}" "${mdAbs}"`);
        console.log(`  => Markdown generated successfully.`);
        console.log(`  => [DOCLING_MODE: ${ticker}] GPU`);
      } catch (err: any) {
        console.error(`  => Failed to convert PDF to MD:`, err.message);
        if (err.code === 2 || err.message.includes("CPU fallback completed")) {
            console.log(`  => CPU Fallback was used successfully.`);
            console.log(`  => [DOCLING_MODE: ${ticker}] CPU Fallback`);
        } else {
            console.error(`  => Skipping this document due to error.`);
            continue;
        }
      }
    } else {
      console.log(`  => Markdown already exists, skipping Docling.`);
    }

    // 2. Read Markdown
    let mdContent = "";
    try {
      mdContent = await fs.readFile(mdPath, 'utf8');
      if (mdContent.length > 8000) {
         mdContent = mdContent.slice(0, 8000); // Truncate if too long
      }
    } catch (e) {
      console.error(`  => Failed to read MD file.`);
      continue;
    }

    if (!mdContent.trim() || mdContent.includes("<!-- image -->") && mdContent.length < 50) {
      console.error(`  => Markdown is essentially empty. Skipping.`);
      continue;
    }

    // 3. LLM Analysis
    console.log(`  => Running LLM Analysis on IR News...`);
    const prompt = `【PDF資料】\n${mdContent}`;
    
    let llmResult = "";
    try {
      // JSON mode explicitly enabled with true argument
      llmResult = await askLLM(`${IR_NEWS_PROMPT}\n\n${prompt}`, true);
    } catch (e: any) {
      console.error(`  => LLM call failed: ${e.message}`);
      continue;
    }

    let parsedJson: any = null;
    try {
      const cleanJsonStr = llmResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedJson = JSON.parse(cleanJsonStr);
    } catch (e) {
      console.error(`  => Failed to parse LLM JSON output. Raw output: ${llmResult}`);
      continue;
    }

    const analysisText = `【IRニュース: ${title}】\n` + 
      `- 事業領域: ${parsedJson.business_domain?.join(", ")}\n` +
      `- コア技術・モデル: ${parsedJson.core_technology_model?.join(", ")}\n` +
      `- ターゲット・課題: ${parsedJson.target_and_problem?.join(", ")}\n` +
      `- 関連検索語: ${parsedJson.search_synonyms?.join(", ")}`;

    parsedResults.push({ row, analysisText, newsId, ticker, title });
  }

  // Unload LLM
  try {
    await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: LLM_MODEL, keep_alive: 0 })
    });
  } catch(e) {}

  return parsedResults;
}
