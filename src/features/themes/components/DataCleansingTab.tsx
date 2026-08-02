'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export function DataCleansingTab() {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ summary: '', theme_keywords: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const fetchAnomalies = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/themes/anomalies');
      const data = await res.json();
      setAnomalies(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const handleEditClick = (row: any) => {
    setEditingTicker(row.ticker);
    setEditForm({
      summary: row.summary || '',
      theme_keywords: row.theme_keywords || ''
    });
  };

  const handleSave = async (ticker: string) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/stocks/${ticker}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setEditingTicker(null);
        await fetchAnomalies(); // refresh list
      } else {
        alert('保存に失敗しました');
      }
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerBatch = async () => {
    if (!confirm('全銘柄のGICS再判定バッチをバックグラウンドで開始しますか？（数分かかります）')) return;
    setIsBatchRunning(true);
    try {
      const res = await fetch('/api/batch/reclassify', { method: 'POST' });
      if (res.ok) {
        alert('バッチ処理を開始しました。数分後に再度アクセスしてください。');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsBatchRunning(false);
    }
  };

  return (
    <div className="theme-grid" style={{ flexDirection: 'column', height: '100%' }}>
      <div className="theme-card" style={{ flexShrink: 0 }}>
        <div className="theme-flex-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>データクレンジング (異常検知)</h2>
            <p style={{ fontSize: '0.875rem', color: '#888' }}>
              LLM監査により、企業の実態とGICS分類定義の間に明白な矛盾（ねじれ）があると判定された「外れ値（異常）」銘柄をリストアップしています。
              <br/>事業要約やキーワードを修正して「保存」後、再判定バッチを回してください。
            </p>
          </div>
          <div className="theme-flex-gap">
            <button onClick={fetchAnomalies} className="theme-btn-outline">
              更新
            </button>
            <button onClick={triggerBatch} disabled={isBatchRunning} className="theme-btn">
              一括再計算バッチ起動
            </button>
          </div>
        </div>
      </div>

      <div className="theme-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="theme-card-header">
          <h3>異常検知リスト ({anomalies.length}件)</h3>
        </div>
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Loading...</div>
        ) : (
          <div className="table-container" style={{ flex: 1, maxHeight: 'none' }}>
            <table className="stock-table" style={{ width: '100%', minWidth: '800px' }}>
              <thead>
                <tr>
                  <th style={{ width: '250px', minWidth: '250px' }}>銘柄</th>
                  <th style={{ width: '250px', minWidth: '250px' }}>東証業種 / GICS分類</th>
                  <th style={{ width: '300px', minWidth: '300px' }}>異常の理由 (LLM判定)</th>
                  <th style={{ minWidth: '300px' }}>要約 & キーワード</th>
                  <th style={{ width: '100px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a, i) => {
                  const isEditing = editingTicker === a.ticker;
                  
                  // Color code the score: below 0.8 is red, below 0.83 is orange
                  const score = Number(a.gics_similarity_score);
                  const scoreColor = score < 0.8 ? 'var(--red)' : score < 0.83 ? 'orange' : 'var(--primary)';
                  
                  return (
                    <tr key={i} style={{ verticalAlign: 'top' }}>
                      <td style={{ fontWeight: '500', paddingTop: '0.75rem', whiteSpace: 'normal' }}>
                        <Link href={`/stocks/${a.ticker}`} style={{ color: 'var(--primary)', display: 'block', marginBottom: '0.25rem' }}>
                          {a.ticker} {a.name}
                        </Link>
                      </td>
                      <td style={{ paddingTop: '0.75rem', whiteSpace: 'normal' }}>
                        <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '0.25rem' }}>東証: {a.industry}</div>
                        <div style={{ fontWeight: '500' }}>GICS: {a.theme}</div>
                      </td>
                      <td style={{ paddingTop: '0.75rem', whiteSpace: 'normal' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--red)', whiteSpace: 'pre-wrap' }}>
                          {a.reasons ? a.reasons[0] : '-'}
                        </div>
                      </td>
                      <td style={{ paddingTop: '0.75rem', whiteSpace: 'normal' }}>
                        {isEditing ? (
                          <div>
                            <textarea 
                              className="edit-textarea"
                              value={editForm.summary}
                              onChange={e => setEditForm({...editForm, summary: e.target.value})}
                              placeholder="事業要約"
                            />
                            <input 
                              type="text"
                              className="edit-input"
                              value={editForm.theme_keywords}
                              onChange={e => setEditForm({...editForm, theme_keywords: e.target.value})}
                              placeholder="キーワード (カンマ区切り)"
                            />
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#888', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={a.summary}>{a.summary || '-'}</div>
                            {a.theme_keywords && (
                              <div className="keyword-badge-container">
                                {a.theme_keywords.split(',').slice(0, 5).map((kw: string, kid: number) => (
                                  <span key={kid} className="keyword-badge">
                                    {kw.trim()}
                                  </span>
                                ))}
                                {a.theme_keywords.split(',').length > 5 && <span style={{ fontSize: '0.625rem', color: '#888' }}>...</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ paddingTop: '0.75rem' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <button 
                              onClick={() => handleSave(a.ticker)}
                              disabled={isSaving}
                              className="theme-btn-success"
                            >
                              {isSaving ? '保存中' : '保存'}
                            </button>
                            <button 
                              onClick={() => setEditingTicker(null)}
                              className="theme-btn-outline"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleEditClick(a)}
                            className="theme-btn-outline"
                          >
                            編集
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
