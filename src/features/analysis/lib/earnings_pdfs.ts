import fs from 'fs';
import path from 'path';

export interface EarningsPdfItem {
  ticker: string;
  date: string;
  title: string;
  pdfPath: string;
  fileSize: number;
}

/**
 * 指定されたティッカー（4桁または5桁）の直近決算PDF資料（最大4期分）を取得する。
 * Docling生成済みの .md が存在する場合は、その見出しから正式な決算短信タイトルを自動抽出する。
 */
export function getEarningsPdfsForTicker(ticker: string): EarningsPdfItem[] {
  const baseTicker = ticker.length > 4 ? ticker.slice(0, 4) : ticker;
  const candidateDirs = [
    path.join(process.cwd(), 'data', 'pdfs', ticker),
    path.join(process.cwd(), 'data', 'pdfs', `${baseTicker}0`),
    path.join(process.cwd(), 'data', 'pdfs', baseTicker),
  ];

  const seenDates = new Set<string>();
  const results: EarningsPdfItem[] = [];

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;

    let files: string[] = [];
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.pdf') || file.includes('ir_newbiz')) continue;

      const match = file.match(/(\d{4}-\d{2}-\d{2})\.pdf$/);
      if (!match) continue;
      const date = match[1];

      if (seenDates.has(date)) continue;
      seenDates.add(date);

      const pdfPath = path.join(dir, file);
      let stat: fs.Stats | null = null;
      try {
        stat = fs.statSync(pdfPath);
      } catch {
        // Skip if stat fails
        continue;
      }

      // Docling Markdownから正式タイトル抽出を試行
      const mdFile = file.replace(/\.pdf$/, '.md');
      const mdPath = path.join(dir, mdFile);
      let title = '';

      if (fs.existsSync(mdPath)) {
        try {
          const mdContent = fs.readFileSync(mdPath, 'utf8');
          const lines = mdContent.split('\n');
          for (const line of lines.slice(0, 40)) {
            const trimmed = line.trim();
            if (
              trimmed.includes('決算短信') ||
              trimmed.includes('四半期報告書') ||
              trimmed.includes('有価証券報告書') ||
              trimmed.includes('決算説明資料') ||
              trimmed.includes('説明資料')
            ) {
              title = trimmed
                .replace(/^#+\s*/, '')
                .replace(/<!--.*?-->/g, '')
                .trim();
              if (title) break;
            }
          }
        } catch {
          // Fallback if read fails
        }
      }

      if (!title) {
        title = `決算短信 (${date})`;
      }

      // Web表示用にポータブルな相対パスに正規化
      const relPath = path.relative(process.cwd(), pdfPath).replace(/\\/g, '/');

      results.push({
        ticker,
        date,
        title,
        pdfPath: relPath,
        fileSize: stat.size,
      });
    }
  }

  // 開示日付の降順でソートし、最新最大4期分を抽出
  results.sort((a, b) => b.date.localeCompare(a.date));
  return results.slice(0, 4);
}
