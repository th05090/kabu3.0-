import React from 'react';
import { MathRenderer } from './MathRenderer';

export type BlockType =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'h4'; text: string }
  | { type: 'hr' }
  | { type: 'code'; lang: string; code: string }
  | { type: 'math'; math: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'quote'; text: string; alertType?: string }
  | { type: 'ul'; items: { text: string; checked?: boolean }[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string };

/**
 * Markdownテキストをブロック要素にパース
 */
export function parseMarkdownToBlocks(md: string): BlockType[] {
  const lines = md.split('\n');
  const blocks: BlockType[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Code block (```)
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') });
      continue;
    }

    // Display Math block ($$)
    if (trimmed.startsWith('$$')) {
      if (trimmed.endsWith('$$') && trimmed.length > 2) {
        blocks.push({ type: 'math', math: trimmed.slice(2, -2).trim() });
        i++;
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('$$')) {
        mathLines.push(lines[i]);
        i++;
      }
      i++; // skip closing $$
      blocks.push({ type: 'math', math: mathLines.join('\n') });
      continue;
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: trimmed.slice(2).trim() });
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3).trim() });
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4).trim() });
      i++;
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      blocks.push({ type: 'h4', text: trimmed.slice(5).trim() });
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      let alertType: string | undefined;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        let qLine = lines[i].trim().slice(1).trim();
        if (qLine.startsWith('[!NOTE]')) { alertType = 'NOTE'; qLine = qLine.slice(7).trim(); }
        else if (qLine.startsWith('[!TIP]')) { alertType = 'TIP'; qLine = qLine.slice(6).trim(); }
        else if (qLine.startsWith('[!IMPORTANT]')) { alertType = 'IMPORTANT'; qLine = qLine.slice(12).trim(); }
        else if (qLine.startsWith('[!WARNING]')) { alertType = 'WARNING'; qLine = qLine.slice(10).trim(); }
        if (qLine) quoteLines.push(qLine);
        i++;
      }
      blocks.push({ type: 'quote', text: quoteLines.join('\n'), alertType });
      continue;
    }

    // Table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (r: string) =>
          r.split('|').slice(1, -1).map((c) => c.trim());
        const headers = parseRow(tableLines[0]);
        const dataRows = tableLines.slice(2).map(parseRow);
        blocks.push({ type: 'table', headers, rows: dataRows });
        continue;
      }
    }

    // List
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: { text: string; checked?: boolean }[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        let itemText = lines[i].trim().slice(2).trim();
        let checked: boolean | undefined = undefined;
        if (itemText.startsWith('[ ] ')) {
          checked = false;
          itemText = itemText.slice(4).trim();
        } else if (itemText.startsWith('[x] ') || itemText.startsWith('[X] ')) {
          checked = true;
          itemText = itemText.slice(4).trim();
        }
        items.push({ text: itemText, checked });
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered List
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s*/, '').trim();
        items.push(itemText);
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Regular Paragraph
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('$$') &&
      !lines[i].trim().startsWith('---') &&
      !lines[i].trim().startsWith('>') &&
      !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) &&
      !lines[i].trim().startsWith('- ') &&
      !lines[i].trim().startsWith('* ') &&
      !/^\d+\.\s/.test(lines[i].trim())
    ) {
      pLines.push(lines[i].trim());
      i++;
    }
    if (pLines.length > 0) {
      blocks.push({ type: 'p', text: pLines.join(' ') });
    }
  }

  return blocks;
}

/**
 * インライン要素（太字, コード, 数式, リンク, 改行）のパース
 */
export function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(<br\s*\/?>)/gi);
  if (parts.length > 1) {
    return parts.map((part, pIdx) => {
      if (/<br\s*\/?>/i.test(part)) return <br key={pIdx} />;
      return <React.Fragment key={pIdx}>{parseInlineFormatting(part)}</React.Fragment>;
    });
  }
  return parseInlineFormatting(text);
}

function parseInlineFormatting(text: string): React.ReactNode {
  // Regex: 1. Code (`...`), 2. Bold (**...**), 3. Link ([...](...)), 4. Inline Math ($...$)
  const regex = /(`.*?`|\*\*.*?\*\*|\[.*?\]\(.*?\)|(?<!\\)\$[^$\n]+?\$)/g;
  const tokens = text.split(regex);

  return tokens.map((token, idx) => {
    if (!token) return null;

    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={idx} className="doc-inline-code">{token.slice(1, -1)}</code>;
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={idx}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('$') && token.endsWith('$') && token.length > 2) {
      const mathContent = token.slice(1, -1);
      return <MathRenderer key={idx} math={mathContent} />;
    }
    const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      return (
        <a
          key={idx}
          href={href}
          className="doc-link"
          target={href.startsWith('http') ? '_blank' : undefined}
          rel="noreferrer"
        >
          {label}
        </a>
      );
    }
    return token;
  });
}
