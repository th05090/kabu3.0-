'use client';

import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  math: string;
  block?: boolean;
}

/**
 * LaTeX / KaTeX 数式レンダラーコンポーネント
 */
export function MathRenderer({ math, block = false }: MathRendererProps) {
  try {
    const html = katex.renderToString(math, {
      displayMode: block,
      throwOnError: false,
    });

    if (block) {
      return (
        <div
          className="doc-math-block"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    return (
      <span
        className="doc-math-inline"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <code>${math}$</code>;
  }
}
