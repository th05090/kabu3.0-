const fs = require('fs');

async function main() {
  const sysPromptContent = fs.readFileSync('src/scripts/analyze_stock_rag.ts', 'utf8');
  const sysPromptMatch = sysPromptContent.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
  const sysPrompt = sysPromptMatch ? sysPromptMatch[1] : "NOT FOUND";

  const promptDumpFull = fs.readFileSync('scratch/prompt_dump.txt', 'utf8');
  const userPrompt = promptDumpFull.split('====== USER PROMPT ======')[1].trim();

  const aiResponse = fs.readFileSync('src/data/toyota_ai_report.json', 'utf8');

  const md = `# RAG Pipeline プロンプト＆回答レポート

## 1. システムプロンプト (SYSTEM_PROMPT)
\`\`\`text
${sysPrompt}
\`\`\`

## 2. LLMへの入力プロンプト (USER_PROMPT + RAG抽出テキスト)
\`\`\`xml
${userPrompt}
\`\`\`

## 3. AIからの最終回答 (JSON)
\`\`\`json
${aiResponse}
\`\`\`
`;

  fs.writeFileSync('C:/Users/honda/.gemini/antigravity/brain/80cd83da-0651-4a23-a74d-e402d8b81d93/prompt_and_response_report.md', md, 'utf8');
}

main();
