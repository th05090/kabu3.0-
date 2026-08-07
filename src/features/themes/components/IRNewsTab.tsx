'use client';

import React, { useState, useEffect } from 'react';

type IRNewsItem = {
  id: string;
  ticker: string;
  title: string;
  date: string;
  pdf_path: string;
  analyzed: number;
};

export function IRNewsTab() {
  const [newsList, setNewsList] = useState<IRNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ir-news')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNewsList(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load IR news', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="tab-pane">
      <h2>IRニュース (新規事業・参入)</h2>
      <p>抽出された新規事業に関連するIR適時開示情報です。</p>
      
      {loading ? (
        <div>Loading...</div>
      ) : newsList.length === 0 ? (
        <div>IRニュースが見つかりません。</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {newsList.map(news => (
            <div key={news.id} style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontWeight: 'bold' }}>{news.ticker}</span>
                <span>{news.date}</span>
              </div>
              <div style={{ fontSize: '1.1em', marginBottom: '10px' }}>
                {news.title}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ 
                  backgroundColor: news.analyzed ? '#4CAF50' : '#FF9800', 
                  color: 'white', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  fontSize: '0.8em'
                }}>
                  {news.analyzed ? 'AI分析済' : '未分析'}
                </span>
                <button 
                  onClick={() => window.open(`/api/pdf-preview?path=${encodeURIComponent(news.pdf_path)}`, '_blank')}
                  style={{ fontSize: '0.8em', padding: '2px 6px' }}
                >
                  PDFを表示
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
