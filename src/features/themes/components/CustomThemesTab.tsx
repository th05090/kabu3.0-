'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DynamicNetworkGraph from './DynamicNetworkGraph';

export function CustomThemesTab() {
  const [themes, setThemes] = useState<any[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<any | null>(null);
  const [themeStocks, setThemeStocks] = useState<any[]>([]);
  const [networkData, setNetworkData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState('');
  const [isAddingStock, setIsAddingStock] = useState(false);

  const fetchThemes = async () => {
    try {
      const res = await fetch('/api/themes');
      const data = await res.json();
      setThemes(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  const selectTheme = async (theme: any) => {
    setSelectedTheme(theme);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/themes/${theme.id}/stocks`);
      const data = await res.json();
      setThemeStocks(data.stocks || []);
      setNetworkData(data.network || { nodes: [], links: [] });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTheme = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('このテーマを削除しますか？')) return;
    
    try {
      await fetch(`/api/themes/${id}`, { method: 'DELETE' });
      if (selectedTheme?.id === id) setSelectedTheme(null);
      fetchThemes();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleThemeSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedThemeIds(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedThemeIds.length === 0) return;
    if (!confirm(`${selectedThemeIds.length}件のテーマを一括削除しますか？`)) return;
    
    try {
      await fetch('/api/themes/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedThemeIds })
      });
      setSelectedThemeIds([]);
      if (selectedThemeIds.includes(selectedTheme?.id)) setSelectedTheme(null);
      fetchThemes();
    } catch (e) {
      console.error(e);
    }
  };

  const removeStock = async (ticker: string) => {
    if (!selectedTheme) return;
    try {
      await fetch(`/api/themes/${selectedTheme.id}/stocks?ticker=${ticker}`, { method: 'DELETE' });
      // Refresh current theme
      selectTheme(selectedTheme);
      fetchThemes();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker || !selectedTheme) return;
    
    setIsAddingStock(true);
    try {
      const res = await fetch(`/api/themes/${selectedTheme.id}/stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: newTicker, similarity_score: 1.0 })
      });
      if (res.ok) {
        setNewTicker('');
        selectTheme(selectedTheme);
        fetchThemes();
      } else {
        alert('追加に失敗しました。ティッカーが存在しない可能性があります。');
      }
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました。');
    } finally {
      setIsAddingStock(false);
    }
  };

  return (
    <div className="theme-grid">
      {/* Sidebar: Theme List */}
      <div className="theme-sidebar">
        <div className="theme-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
          <h2>保存したテーマ</h2>
          {selectedThemeIds.length > 0 && (
            <button onClick={handleBulkDelete} className="theme-btn-danger" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
              選択したテーマを削除 ({selectedThemeIds.length})
            </button>
          )}
        </div>
        {themes.length === 0 ? (
          <p style={{ color: '#888', fontSize: '0.875rem' }}>テーマがありません。</p>
        ) : (
          <ul className="theme-list">
            {themes.map(t => (
              <li 
                key={t.id}
                className={`theme-list-item ${selectedTheme?.id === t.id ? 'active' : ''}`}
                onClick={() => selectTheme(t)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedThemeIds.includes(t.id)}
                  onChange={() => {}}
                  onClick={(e) => toggleThemeSelection(t.id, e)}
                  style={{ cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div className="item-title">{t.name}</div>
                  <div className="item-meta">{t.stock_count} 銘柄</div>
                </div>
                <button 
                  onClick={(e) => deleteTheme(t.id, e)}
                  className="item-delete"
                  title="削除"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Main Content: Theme Details */}
      <div className="theme-main">
        {selectedTheme ? (
          <>
            <div className="theme-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="theme-card-header">
                <h2>{selectedTheme.name} - ネットワークグラフ</h2>
              </div>
              {isLoading ? (
                <div className="center-message">Loading...</div>
              ) : (
                <div className="graph-container">
                  <DynamicNetworkGraph data={networkData} />
                </div>
              )}
            </div>
            
            <div className="theme-card">
              <div className="theme-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>構成銘柄 ({themeStocks.length})</h3>
                <form onSubmit={handleAddStock} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="theme-input"
                    placeholder="ティッカー (例: 72030)"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', width: '150px' }}
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value)}
                  />
                  <button type="submit" disabled={!newTicker || isAddingStock} className="theme-btn-success" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                    {isAddingStock ? '追加中' : '追加'}
                  </button>
                </form>
              </div>
              <div className="table-container" style={{ maxHeight: '400px' }}>
                <table className="stock-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--background)' }}>銘柄</th>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--background)' }}>業種</th>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--background)' }}>時価総額</th>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--background)' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {themeStocks.map(s => (
                      <tr key={s.ticker}>
                        <td style={{ fontWeight: '500' }}>
                          <Link href={`/stocks/${s.ticker}`} style={{ color: 'var(--primary)' }}>
                            {s.ticker} {s.name}
                          </Link>
                        </td>
                        <td>{s.industry}</td>
                        <td>{Number(s.market_cap || 0).toLocaleString()} 億</td>
                        <td>
                          <button 
                            onClick={() => removeStock(s.ticker)}
                            className="theme-btn-danger"
                          >
                            除外
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="center-message" style={{ height: '100%' }}>
            左側のリストからテーマを選択してください
          </div>
        )}
      </div>
    </div>
  );
}
