'use client';

import React, { useState, useEffect } from 'react';
import 'katex/dist/katex.min.css';
import { DOCS_REGISTRY, DocItem } from '../docs_data';
import { SimpleMarkdownViewer } from './SimpleMarkdownViewer';
import { BookOpen, FileText, Compass, TrendingUp, Cpu, BarChart3, ChevronRight, Loader2 } from 'lucide-react';

export function DocsLayout() {
  const [selectedDocId, setSelectedDocId] = useState<string>('playbook');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const selectedDoc = DOCS_REGISTRY.find((d) => d.id === selectedDocId) || DOCS_REGISTRY[0];

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/docs?id=${selectedDoc.id}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setContent(data.content || '');
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDoc.id]);

  const getDocIcon = (category: DocItem['category']) => {
    switch (category) {
      case 'playbook':
        return <BookOpen size={18} style={{ color: '#10b981' }} />;
      case 'trading':
        return <TrendingUp size={18} style={{ color: '#38bdf8' }} />;
      case 'themes':
        return <Compass size={18} style={{ color: '#f59e0b' }} />;
      case 'analysis':
        return <Cpu size={18} style={{ color: '#c084fc' }} />;
      default:
        return <FileText size={18} style={{ color: '#94a3b8' }} />;
    }
  };

  return (
    <div className="docs-page-container">
      {/* 左ペイン: ドキュメント一覧メニュー */}
      <aside className="docs-sidebar">
        <div className="docs-sidebar-header">
          <BookOpen size={20} style={{ color: '#10b981' }} />
          <span>ドキュメント・マニュアル</span>
        </div>

        <div className="docs-nav-list">
          {DOCS_REGISTRY.map((doc) => {
            const isActive = doc.id === selectedDoc.id;
            return (
              <button
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`docs-nav-item ${isActive ? 'active' : ''}`}
              >
                <div className="docs-nav-item-icon">
                  {getDocIcon(doc.category)}
                </div>
                <div className="docs-nav-item-info">
                  <div className="docs-nav-item-title-row">
                    <span className="docs-nav-item-title">{doc.title}</span>
                    {doc.badge && <span className="docs-item-badge">{doc.badge}</span>}
                  </div>
                  <span className="docs-nav-item-cat">{doc.categoryLabel}</span>
                </div>
                <ChevronRight size={14} className="docs-nav-chevron" />
              </button>
            );
          })}
        </div>
      </aside>

      {/* 右ペイン: ドキュメント本文ビューア */}
      <main className="docs-content-pane">
        <header className="docs-content-header">
          <div className="docs-content-meta">
            <span className="docs-content-cat-badge">{selectedDoc.categoryLabel}</span>
            <h1>{selectedDoc.title}</h1>
            <p>{selectedDoc.description}</p>
          </div>
        </header>

        <div className="docs-body-scroll-area">
          {loading && (
            <div className="docs-state-box">
              <Loader2 size={24} className="animate-spin" style={{ color: '#10b981' }} />
              <span>ドキュメントを読み込み中...</span>
            </div>
          )}

          {error && (
            <div className="docs-state-box error">
              <span>エラーが発生しました: {error}</span>
            </div>
          )}

          {!loading && !error && (
            <div className="docs-markdown-card">
              <SimpleMarkdownViewer content={content} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
