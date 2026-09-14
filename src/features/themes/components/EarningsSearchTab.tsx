'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { EarningsSearchResultItem } from '@/app/api/themes/earnings-search/route';

const SAMPLE_QUERIES = [
  '半導体 受注 好調',
  'データセンター 冷却 電源',
  '価格改定 収益改善',
  'インバウンド 需要 伸長',
  '蓄電池 系統用',
];

export function EarningsSearchTab() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'and' | 'vector'>('and');
  const [onlyLatest, setOnlyLatest] = useState(true);
  const [results, setResults] = useState<EarningsSearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent, customQuery?: string, customMode?: 'and' | 'vector') => {
    if (e) e.preventDefault();
    const q = (customQuery !== undefined ? customQuery : query).trim();
    const m = customMode || mode;
    if (!q) return;

    if (customQuery !== undefined) setQuery(customQuery);
    if (customMode !== undefined) setMode(customMode);

    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch('/api/themes/earnings-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, mode: m, onlyLatest }),
      });
      const data = await res.json();
      if (res.ok) {
        setResults(data.results || []);
      } else {
        alert('検索エラー: ' + (data.error || '不明なエラー'));
      }
    } catch (err: any) {
      console.error('Search failed:', err);
      alert('通信エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const highlightSnippet = (text: string, queryStr: string) => {
    if (!text) return '';
    const words = queryStr.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return text;

    const regex = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          style={{
            backgroundColor: 'rgba(234, 179, 8, 0.25)',
            color: '#fef08a',
            padding: '1px 3px',
            borderRadius: '3px',
            fontWeight: 600,
          }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 検索コントロールヘッダー */}
      <div style={{ backgroundColor: 'var(--card-bg, rgba(255,255,255,0.03))', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <form onSubmit={(e) => handleSearch(e)} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'and' ? 'スペース区切りで複数キーワード（例: 半導体 受注 好調）' : '自然言語で検索（例: データセンター向け冷却設備や電源需要の増加）'}
            style={{
              flex: 1,
              padding: '0.65rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '0.95rem',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            style={{
              padding: '0.65rem 1.5rem',
              backgroundColor: 'var(--primary, #3b82f6)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? '検索中...' : '検索'}
          </button>
        </form>

        {/* モード切替 & フィルタトグル */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginRight: '0.25rem' }}>モード:</span>
            <button
              type="button"
              onClick={() => {
                setMode('and');
                if (query.trim()) handleSearch(undefined, query, 'and');
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: mode === 'and' ? 700 : 500,
                border: '1px solid',
                borderColor: mode === 'and' ? 'var(--primary, #3b82f6)' : 'var(--border)',
                backgroundColor: mode === 'and' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: mode === 'and' ? 'var(--primary, #3b82f6)' : 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              🔍 AND条件検索
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('vector');
                if (query.trim()) handleSearch(undefined, query, 'vector');
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: mode === 'vector' ? 700 : 500,
                border: '1px solid',
                borderColor: mode === 'vector' ? 'var(--primary, #3b82f6)' : 'var(--border)',
                backgroundColor: mode === 'vector' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: mode === 'vector' ? 'var(--primary, #3b82f6)' : 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              🧠 ベクトル検索 (意味・文脈)
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.825rem', cursor: 'pointer', color: 'var(--foreground)' }}>
            <input
              type="checkbox"
              checked={onlyLatest}
              onChange={(e) => setOnlyLatest(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>各社の最新決算のみ対象</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>(過去四半期の重複を除外)</span>
          </label>
        </div>

        {/* サンプルクエリ */}
        <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>おすすめ候補:</span>
          {SAMPLE_QUERIES.map((sq, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSearch(undefined, sq)}
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                backgroundColor: 'rgba(255,255,255,0.02)',
                color: 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* 検索結果一覧 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
            検索結果 {hasSearched && `(${results.length} 件)`}
          </h2>
          {mode === 'vector' && hasSearched && (
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>BGE-M3 ベクトル類似度スコア順</span>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            決算書データベース（30万件）を検索中...
          </div>
        ) : !hasSearched ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
            検索キーワードまたは自然言語を入力して検索を実行してください。
          </div>
        ) : results.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
            該当する決算書が見つかりませんでした。キーワードを変更するか、「各社の最新決算のみ対象」のチェックを外してお試しください。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {results.map((r, idx) => (
              <div
                key={`${r.ticker}_${idx}`}
                style={{
                  backgroundColor: 'var(--card-bg, rgba(255,255,255,0.03))',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                {/* 企業ヘッダー（タイトルは非表示） */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <Link
                      href={`/stocks/${r.ticker}`}
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--primary, #3b82f6)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textDecoration: 'none',
                      }}
                    >
                      {r.ticker.slice(0, 4)}
                    </Link>
                    <Link
                      href={`/stocks/${r.ticker}`}
                      style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)', textDecoration: 'none' }}
                    >
                      {r.name}
                    </Link>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: '4px' }}>
                      {r.market} / {r.industry}
                    </span>
                    {r.currentPrice != null && (
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        ¥{r.currentPrice.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {r.score != null && (
                      <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        一致度: {r.score}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', backgroundColor: 'var(--hover-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                      開示: {r.period}
                    </span>
                  </div>
                </div>

                {/* セクション見出し & スニペット抜粋 */}
                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {r.section && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary, #3b82f6)', marginBottom: '0.35rem' }}>
                      📌 {r.section}
                    </div>
                  )}
                  <div style={{ fontSize: '0.875rem', color: '#e2e8f0', lineHeight: '1.55' }}>
                    {highlightSnippet(r.snippet, query)}
                  </div>
                </div>

                {/* フッター: PDF原本リンク */}
                {r.pdfPath && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => window.open(`/api/pdf-preview?path=${encodeURIComponent(r.pdfPath!)}`, '_blank')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--primary, #3b82f6)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        borderRadius: '4px',
                        padding: '4px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <span>PDFを表示</span>
                      <span style={{ fontSize: '0.8rem' }}>↗</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
