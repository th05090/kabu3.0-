'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export function ThemeSearchTab() {
  const [query, setQuery] = useState('');
  const [expandedKeywords, setExpandedKeywords] = useState('');
  const [lastExpandedQuery, setLastExpandedQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [themeName, setThemeName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    let keywordsToSearch = expandedKeywords;

    // Expand query if it's new
    if (query !== lastExpandedQuery) {
      setIsExpanding(true);
      try {
        const expandRes = await fetch('/api/themes/expand-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        const expandData = await expandRes.json();
        keywordsToSearch = expandData.expandedKeywords || '';
        setExpandedKeywords(keywordsToSearch);
        setLastExpandedQuery(query);
      } catch (err) {
        console.error("Expand error", err);
      } finally {
        setIsExpanding(false);
      }
    }

    setIsLoading(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/themes/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, expandedKeywords: keywordsToSearch })
      });
      const data = await res.json();
      const resultsData = data.results || [];
      setResults(resultsData);
      setSelectedTickers(resultsData.map((r: any) => r.ticker));
    } catch (err) {
      console.error(err);
      alert('検索に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTheme = async () => {
    if (!themeName || selectedTickers.length === 0) return;
    
    setIsSaving(true);
    try {
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: themeName,
          tickers: selectedTickers
        })
      });
      
      if (res.ok) {
        setSaveSuccess(true);
        setThemeName('');
      } else {
        alert('テーマの保存に失敗しました。');
      }
    } catch (err) {
      console.error(err);
      alert('テーマの保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="theme-grid">
      <div className="theme-card" style={{ flex: 1 }}>
        <div className="theme-card-header">
          <h2>自然言語テーマ検索</h2>
          <p>
            「インバウンド」「DX支援」「シニア向けビジネス」などの抽象的なキーワードや文章で、関連する銘柄を検索します。
          </p>
        </div>
        <form onSubmit={handleSearch} className="theme-search-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              className="theme-input"
              placeholder="検索したいテーマを入力..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={isLoading || isExpanding}
              className="theme-btn"
            >
              {isExpanding ? 'AI推論中...' : isLoading ? '検索中...' : '検索'}
            </button>
          </div>
          
          {(expandedKeywords || isExpanding || lastExpandedQuery) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--foreground)', opacity: 0.8, fontWeight: 'bold' }}>
                AI拡張キーワード (編集して再検索可能)
              </label>
              <input 
                type="text" 
                className="theme-input" 
                style={{ fontSize: '0.875rem', backgroundColor: 'var(--card-bg)' }}
                value={expandedKeywords}
                onChange={(e) => setExpandedKeywords(e.target.value)}
                placeholder={isExpanding ? "AIがキーワードを推論しています..." : "関連キーワードが自動で入ります"}
              />
            </div>
          )}
        </form>
      </div>

      {results.length > 0 && (
        <div className="theme-card" style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
          <div className="theme-flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>検索結果: {results.length}件</h3>
            <div className="theme-flex-gap">
              <input
                type="text"
                placeholder="テーマ名をつけて保存..."
                className="theme-input"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
              />
              <button
                onClick={handleSaveTheme}
                disabled={isSaving || !themeName}
                className="theme-btn-success"
              >
                {isSaving ? '保存中...' : 'マイテーマとして保存'}
              </button>
            </div>
          </div>
          
          {saveSuccess && (
            <div style={{ color: 'var(--green)', fontSize: '0.875rem', marginBottom: '1rem' }}>マイテーマに保存しました！「マイテーマ」タブから確認できます。</div>
          )}

          <div className="table-container">
            <table className="stock-table" style={{ width: '100%', minWidth: '600px' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--background)', width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedTickers.length === results.length && results.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTickers(results.map(r => r.ticker));
                        } else {
                          setSelectedTickers([]);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--background)' }}>銘柄</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--background)' }}>類似度</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--background)' }}>株価</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--background)' }}>業種</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--background)' }}>事業要約</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox"
                        checked={selectedTickers.includes(r.ticker)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTickers(prev => [...prev, r.ticker]);
                          } else {
                            setSelectedTickers(prev => prev.filter(t => t !== r.ticker));
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      <Link href={`/stocks/${r.ticker}`} style={{ color: 'var(--primary)' }}>
                        {r.ticker} {r.name}
                      </Link>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold' }}>{(r.search_score || 0).toFixed(3)}</span>
                        <span style={{ fontSize: '0.7rem', color: '#888' }}>
                          (Dense: {(r.dense_score || 0).toFixed(3)} / Sparse: {(r.sparse_score || 0).toFixed(3)})
                        </span>
                      </div>
                    </td>
                    <td>¥{r.current_price?.toLocaleString()}</td>
                    <td>{r.industry}</td>
                    <td className="truncate" style={{ maxWidth: '200px', fontSize: '0.75rem', color: '#888' }} title={r.summary}>
                      {r.summary || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
