'use client';

import React from 'react';
import { parseMarkdownToBlocks, renderInline, BlockType } from './markdown_parser';
import { MathRenderer } from './MathRenderer';

interface MarkdownViewerProps {
  content: string;
}

/**
 * 2ペイン用Markdownビューアコンポーネント
 */
export function SimpleMarkdownViewer({ content }: MarkdownViewerProps) {
  const blocks = parseMarkdownToBlocks(content);

  return (
    <div className="markdown-doc-body">
      {blocks.map((block, idx) => (
        <React.Fragment key={idx}>{renderBlock(block, idx)}</React.Fragment>
      ))}
    </div>
  );
}

function renderBlock(block: BlockType, key: number) {
  switch (block.type) {
    case 'h1':
      return <h1 key={key} className="doc-h1">{renderInline(block.text)}</h1>;
    case 'h2':
      return <h2 key={key} className="doc-h2">{renderInline(block.text)}</h2>;
    case 'h3':
      return <h3 key={key} className="doc-h3">{renderInline(block.text)}</h3>;
    case 'h4':
      return <h4 key={key} className="doc-h4">{renderInline(block.text)}</h4>;
    case 'hr':
      return <hr key={key} className="doc-hr" />;
    case 'math':
      return <MathRenderer key={key} math={block.math} block />;
    case 'code':
      return (
        <div key={key} className="doc-code-block">
          {block.lang && <div className="doc-code-lang">{block.lang}</div>}
          <pre><code>{block.code}</code></pre>
        </div>
      );
    case 'quote':
      return (
        <blockquote key={key} className={`doc-quote ${block.alertType ? `alert-${block.alertType.toLowerCase()}` : ''}`}>
          {block.alertType && <div className="doc-alert-badge">{block.alertType}</div>}
          {block.text.split('\n').map((l, idx) => (
            <p key={idx}>{renderInline(l)}</p>
          ))}
        </blockquote>
      );
    case 'table':
      return (
        <div key={key} className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                {block.headers.map((h, hIdx) => (
                  <th key={hIdx}>{renderInline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'ul':
      return (
        <ul key={key} className="doc-ul">
          {block.items.map((item, idx) => (
            <li key={idx} className={item.checked !== undefined ? 'checklist-item' : ''}>
              {item.checked !== undefined && (
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly
                  style={{ marginRight: '0.5rem', accentColor: '#10b981' }}
                />
              )}
              {renderInline(item.text)}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} className="doc-ol">
          {block.items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case 'p':
      return <p key={key} className="doc-p">{renderInline(block.text)}</p>;
  }
}
