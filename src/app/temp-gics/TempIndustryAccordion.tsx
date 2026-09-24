'use client';

import React from 'react';
import { ChevronDown, ChevronRight, Edit3, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { TempGicsStockItem } from '../api/temp-gics/route';

interface TempIndustryAccordionProps {
  industryId: string;
  industryName: string;
  sectorName: string;
  groupName: string;
  items: TempGicsStockItem[];
  isOpen: boolean;
  onToggle: () => void;
  onEditClick: (item: TempGicsStockItem) => void;
}

export function TempIndustryAccordion({
  industryId,
  industryName,
  sectorName,
  groupName,
  items,
  isOpen,
  onToggle,
  onEditClick,
}: TempIndustryAccordionProps) {
  const isUnclassified = industryId === '999999';

  return (
    <div
      style={{
        borderRadius: '8px',
        backgroundColor: '#0f172a',
        border: isUnclassified
          ? '1px solid rgba(239, 68, 68, 0.4)'
          : '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* アコーディオンヘッダー */}
      <div
        onClick={onToggle}
        style={{
          padding: '0.75rem 1.25rem',
          backgroundColor: isOpen
            ? 'rgba(30, 41, 59, 0.9)'
            : isUnclassified
            ? 'rgba(239, 68, 68, 0.08)'
            : 'rgba(15, 23, 42, 0.6)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
          borderBottom: isOpen ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: isOpen ? '#38bdf8' : '#94a3b8' }}>
            {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isUnclassified ? '#f87171' : '#f8fafc' }}>
                {industryName}
              </span>
              {!isUnclassified && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    color: '#38bdf8',
                  }}
                >
                  {industryId}
                </span>
              )}
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '9999px',
                  backgroundColor: isUnclassified ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  color: isUnclassified ? '#fca5a5' : '#cbd5e1',
                  fontWeight: 600,
                }}
              >
                {items.length} 銘柄
              </span>
            </div>
            {!isUnclassified && (
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                大分類: {sectorName} &gt; 中分類: {groupName}
              </div>
            )}
          </div>
        </div>

        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {isOpen ? 'クリックで閉じる' : 'クリックで展開'}
        </span>
      </div>

      {/* ドリルダウン: 所属銘柄リスト */}
      {isOpen && (
        <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {items.map((item) => {
            const shortTicker = item.ticker.length > 4 ? item.ticker.slice(0, 4) : item.ticker;
            return (
              <div
                key={item.ticker}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(30, 41, 59, 0.4)',
                  fontSize: '0.85rem',
                }}
              >
                {/* 銘柄名 (コード) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                    {shortTicker}
                  </span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{item.name}</span>
                  <Link
                    href={`/stocks/${item.ticker}`}
                    target="_blank"
                    title="個別銘柄詳細を別タブで開く"
                    style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center' }}
                  >
                    <ExternalLink size={13} />
                  </Link>
                </div>

                {/* 現在の細分類 (クリックで修正) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>細分類:</span>
                  <button
                    type="button"
                    onClick={() => onEditClick(item)}
                    title="クリックして細分類を変更"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      backgroundColor: item.is_unclassified
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(59, 130, 246, 0.15)',
                      border: item.is_unclassified
                        ? '1px solid rgba(239, 68, 68, 0.4)'
                        : '1px solid rgba(59, 130, 246, 0.4)',
                      color: item.is_unclassified ? '#fca5a5' : '#93c5fd',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = item.is_unclassified
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(59, 130, 246, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = item.is_unclassified
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(59, 130, 246, 0.15)';
                    }}
                  >
                    <span>{item.sub_industry_name || '未選択'}</span>
                    <Edit3 size={11} style={{ opacity: 0.8 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
