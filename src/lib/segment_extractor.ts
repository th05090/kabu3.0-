import { QdrantClient } from "@qdrant/js-client-rest";
import { askLLM } from "../scripts/rag/theme_prompts";

const EMBED_URL = "http://localhost:11434/api/embeddings";
const EMBED_MODEL = "bge-m3";

export async function embedOllama(model: string, prompt: string) {
    const res = await fetch(EMBED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt })
    });
    if (!res.ok) throw new Error("Embed failed");
    return await res.json();
}

function parseMarkdownTable(markdownTable: string) {
  const lines = markdownTable.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
  const dataLines = lines.filter(l => !l.replace(/\|/g, '').match(/^[\s\-\:]+$/));
  
  const grid = dataLines.map(line => {
    let cols = line.split('|');
    cols.shift(); 
    if (cols.length > 0 && cols[cols.length - 1].trim() === '') cols.pop();
    return cols.map(c => c.replace(/\s+/g, ''));
  });
  if (grid.length === 0) return null;

  let targetRow = -1, targetCol = -1, isTransposed = false;
  const revenueKeywords = ["外部顧客", "顧客との契約", "売上高", "営業収益", "売上収益", "収益"];
  
  for (let keyword of revenueKeywords) {
    for (let r = 0; r < grid.length; r++) {
      if (grid[r][0] && grid[r][0].includes(keyword)) {
        targetRow = r; isTransposed = true; break;
      }
    }
    if (targetRow !== -1) break;
  }
  if (targetRow === -1) {
    for (let keyword of revenueKeywords) {
      for (let r = 0; r < Math.min(2, grid.length); r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c] && grid[r][c].includes(keyword)) {
            targetCol = c; isTransposed = false; break;
          }
        }
        if (targetCol !== -1) break;
      }
      if (targetCol !== -1) break;
    }
  }

  const results = [];
  const excludeRegex = /計|合計|調整額|全社|その他|消去|連結|損益計算書/;

  if (isTransposed && targetRow !== -1) {
    for (let c = 1; c < grid[0].length; c++) {
      let segName = '';
      for (let r = 0; r < targetRow; r++) {
        const cell = grid[r][c] ? grid[r][c].trim() : '';
        if(cell && !cell.includes('報告セグメント') && !cell.includes('セグメント情報') && !/^[\d,\.\-\+－]+$/.test(cell)) {
          segName += cell;
        }
      }
      if (!segName) continue;
      if (excludeRegex.test(segName)) break;
      
      const revenueStr = grid[targetRow][c] || "";
      if (revenueStr) {
        results.push({ segment: segName, revenue: revenueStr });
      }
    }
  } else if (!isTransposed && targetCol !== -1) {
    for (let r = 1; r < grid.length; r++) {
      let segName = grid[r][0];
      if (!segName) continue;
      if (excludeRegex.test(segName)) break;
      
      const revenueStr = grid[r][targetCol] || "";
      if (revenueStr) {
        results.push({ segment: segName, revenue: revenueStr });
      }
    }
  }
  return results.length > 0 ? results : null;
}

export function runStage1(markdown: string) {
  const tableRegex = /\|?[^\n]*?(?:報告セグメント|セグメント情報|事業部門|セグメント)[^\n]*?\|?\r?\n[ \|\-:]+\r?\n(?:\|?[^\n]*?\|?\r?\n)+/g;
  const matches = markdown.match(tableRegex);
  if (!matches) return null;
  for (const match of matches) {
      const parsed = parseMarkdownTable(match);
      if (parsed) return parsed;
  }
  return null;
}

export function runStage2(markdown: string) {
  const regexes = [
    /(?:当社グループの事業セグメントは|当社グループの報告セグメントは|当社グループは|当社は)(?:、)?(?:「)?([^、。「」\n]+?)(?:」)?(?:事業)?の?単一(?:の)?(?:セグメント|事業)[^、。\n]*?である(?:ため|り)/,
    /(?:当社グループは|当社は)(?:、)?([^、。「」\n]+?)(?:事業)?のみの単一(?:の)?(?:セグメント|事業)/
  ];
  for (const regex of regexes) {
    const m = markdown.match(regex);
    if (m && m[1]) {
      let segName = m[1].replace(/\s+/g, '').replace(/事業$/, '') + '事業';
      if (segName.includes("当社")) continue;
      return [{ segment: segName, revenue: "N/A (Single)" }];
    }
  }
  return null;
}

export async function runStage3(ticker: string, qdrant: QdrantClient) {
    let embedRes;
    try {
        embedRes = await embedOllama(EMBED_MODEL, "セグメント情報 事業別 報告 計 | 収益");
    } catch(e) {
        return null;
    }

    let searchRes;
    try {
        searchRes = await qdrant.search('earnings_reports', { 
            vector: embedRes.embedding, 
            limit: 3,
            filter: { must: [{ key: 'ticker', match: { value: ticker } }] }
        });
    } catch(e) {
        return null;
    }
    
    if (!searchRes || searchRes.length === 0) return null;
    
    const context = searchRes.map((r: any, i: number) => `【Chunk ${i + 1}】\n${r.payload.text}`).join('\n\n');
    
    const prompt = `あなたは企業の決算説明資料から、事業セグメントとその売上高を抽出する専門家です。
以下のテキストから、報告されている事業セグメント名と、その売上高（または収益）を抽出してください。

【厳格なルール】
- 以下のフォーマットの箇条書きテキストとして出力してください。余計な文章は一切含めないでください。
  - セグメント: [セグメント名], 売上高: [数値]
  - セグメント: [セグメント名], 売上高: [数値]
- 「国内」「海外」「日本」「北米」などの地域別売上や、「第1四半期」「上期」などの期間別データ、または「売上高」「営業利益」などの単なる勘定科目しかない場合は、セグメント情報ではないため、絶対に「なし」とだけ出力してください。
- 該当するセグメント情報が見つからない場合も「なし」と出力してください。

【テキスト】
${context}`;

    let textOutput = "";
    try {
      textOutput = await askLLM(prompt, false); // format false means plain text
    } catch (e) {
      return null;
    }
    
    if (textOutput.includes("なし") && !textOutput.includes("セグメント:")) {
        return null;
    }
    
    const regex = /\-\s*セグメント:\s*(.+?),\s*売上高:\s*([\d,]+)/g;
    let match;
    const segments = [];
    const excludeRegex = /計|合計|調整額|全社|その他|消去|連結|損益計算書/; // Filters out totals

    while ((match = regex.exec(textOutput)) !== null) {
        const segName = match[1].trim();
        if (excludeRegex.test(segName)) {
            console.log(`[Stage 3 Filtered Out]: ${segName}`);
            continue; 
        }
        segments.push({ segment: segName, revenue: match[2].trim() });
    }
    
    return segments.length > 0 ? segments : null;
}
