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
              東証業種とGICS大分類が乖離している銘柄や、Qdrantでの分類スコアが低い（0.65未満）銘柄を抽出しています。
              <br/>要約やキーワードを修正し「再判定」ボタンを押すことで、ベクトルが再計算されGICSが再分類されます。
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
                  <th style={{ width: '200px', minWidth: '200px' }}>銘柄</th>
                  <th style={{ width: '250px', minWidth: '250px' }}>検知理由</th>
                  <th style={{ width: '200px', minWidth: '200px' }}>東証業種 / GICS分類 (Score)</th>
                  <th style={{ minWidth: '300px' }}>要約 & キーワード</th>
                  <th style={{ width: '100px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a, i) => {
                  const isEditing = editingTicker === a.ticker;
                  return (
                    <tr key={i} style={{ verticalAlign: 'top' }}>
                      <td style={{ fontWeight: '500', paddingTop: '0.75rem', whiteSpace: 'normal' }}>
                        <Link href={`/stocks/${a.ticker}`} style={{ color: 'var(--primary)', display: 'block', marginBottom: '0.25rem' }}>
                          {a.ticker} {a.name}
                        </Link>
                      </td>
                      <td style={{ paddingTop: '0.75rem', whiteSpace: 'normal' }}>
                        <ul className="anomaly-list" style={{ whiteSpace: 'normal' }}>
                          {a.reasons.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                        </ul>
                      </td>
                      <td style={{ paddingTop: '0.75rem', whiteSpace: 'normal' }}>
                        <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '0.25rem' }}>東証: {a.industry}</div>
                        <div style={{ fontWeight: '500' }}>GICS: {a.theme}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Score: {Number(a.gics_similarity_score).toFixed(3)}</div>
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
