"use client";

import React from 'react';
import { EarningsPdfItem } from '../lib/earnings_pdfs';

interface Props {
  pdfs: EarningsPdfItem[];
}

export function EarningsPdfsCard({ pdfs }: Props) {
  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleOpenPdf = (pdfPath: string) => {
    window.open(`/api/pdf-preview?path=${encodeURIComponent(pdfPath)}`, '_blank');
  };

  return (
    <div className="bento-card card-full" style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📑</span>
          <span>決算開示資料 (直近4期 PDF)</span>
        </h2>
        <span style={{ 
          fontSize: '0.8rem', 
          backgroundColor: pdfs.length > 0 ? 'rgba(59, 130, 246, 0.15)' : 'var(--hover-bg)', 
          color: pdfs.length > 0 ? '#3b82f6' : 'var(--muted-foreground)',
          border: '1px solid var(--border)',
          padding: '2px 8px', 
          borderRadius: '9999px',
          fontWeight: 600
        }}>
          {pdfs.length} 件保存済
        </span>
      </div>

      {pdfs.length === 0 ? (
        <div style={{ 
          padding: '2rem 1rem', 
          textAlign: 'center', 
          color: 'var(--muted-foreground)', 
          fontSize: '0.9rem',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px',
          border: '1px dashed var(--border)'
        }}>
          <p style={{ margin: 0, fontWeight: 500 }}>保存されている決算資料（PDF）はありません。</p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
            サイドバーの「データ同期」を実行すると、最新の決算短信PDFが自動ダウンロードされ、ここに表示されます。
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
          gap: '1rem' 
        }}>
          {pdfs.map((item, idx) => (
            <div 
              key={`${item.ticker}_${item.date}_${idx}`}
              style={{
                backgroundColor: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.2s, transform 0.2s',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 700, 
                    color: 'var(--primary, #3b82f6)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {item.date}
                  </span>
                  {item.fileSize > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                      {formatFileSize(item.fileSize)}
                    </span>
                  )}
                </div>
                <div style={{ 
                  fontSize: '0.95rem', 
                  fontWeight: 600, 
                  color: 'var(--foreground)', 
                  lineHeight: '1.4',
                  marginBottom: '1rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }} title={item.title}>
                  {item.title}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px dashed var(--border)', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => handleOpenPdf(item.pdfPath)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    color: 'var(--primary, #3b82f6)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)';
                  }}
                >
                  <span>PDFを表示</span>
                  <span style={{ fontSize: '0.9rem' }}>↗</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
