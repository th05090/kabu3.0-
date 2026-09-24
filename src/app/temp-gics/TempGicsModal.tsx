'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, Layers, Check } from 'lucide-react';
import { GICS_DICTIONARY, GICSClassification } from '@/data/gics_dictionary';

interface TempGicsModalProps {
  ticker: string;
  stockName: string;
  currentSubIndustryId: string;
  currentSubIndustryName: string;
  onClose: () => void;
  onUpdated: (newSubIndustryId: string, newGics: GICSClassification) => void;
}

interface SubIndustryOption extends GICSClassification {
  id: string;
}

export function TempGicsModal({
  ticker,
  stockName,
  currentSubIndustryId,
  currentSubIndustryName,
  onClose,
  onUpdated,
}: TempGicsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // GICS辞書一覧
  const allSubIndustries = useMemo<SubIndustryOption[]>(() => {
    return Object.entries(GICS_DICTIONARY)
      .map(([id, val]) => ({
        id,
        ...val,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, []);

  // 検索フィルタ
  const filteredSubIndustries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allSubIndustries;
    return allSubIndustries.filter((item) => {
      return (
        item.id.includes(q) ||
        item.sub_industry_name.toLowerCase().includes(q) ||
        item.industry_name.toLowerCase().includes(q) ||
        item.industry_group_name.toLowerCase().includes(q) ||
        item.sector_name.toLowerCase().includes(q)
      );
    });
  }, [allSubIndustries, searchQuery]);

  // 細分類選択
  const handleSelect = async (option: SubIndustryOption) => {
    setIsSaving(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/stocks/${ticker}/gics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subIndustryId: option.id }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onUpdated(option.id, option);
        onClose();
      } else {
        setErrorMsg(data.error || '更新に失敗しました');
      }
    } catch (err: any) {
      console.error('Failed to update GICS:', err);
      setErrorMsg('通信エラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.8))',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={20} style={{ color: '#38bdf8' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                GICS細分類の変更
              </h3>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              対象: <strong style={{ color: '#f1f5f9' }}>{stockName}</strong> ({ticker}) ｜ 現在: <span style={{ color: '#fbbf24' }}>{currentSubIndustryName || '未分類'}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 検索バー */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.6rem 0.8rem',
            }}
          >
            <Search size={16} style={{ color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="細分類名、小分類、大分類、コード(8桁)で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                outline: 'none',
                fontSize: '0.9rem',
              }}
            />
          </div>
          {/* クイック選択タグ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>クイック選択:</span>
            {[
              { id: '99101010', label: '株式以外' },
              { id: '99101020', label: 'ETF・ETN' },
              { id: '99101030', label: '投資信託・REIT' },
            ].map((shortcut) => {
              const opt = GICS_DICTIONARY[shortcut.id];
              if (!opt) return null;
              return (
                <button
                  key={shortcut.id}
                  type="button"
                  onClick={() => !isSaving && handleSelect({ id: shortcut.id, ...opt })}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  ⚡ {shortcut.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
            <span>候補: {filteredSubIndustries.length} 件 (クリック即座にDB保存されます)</span>
            {isSaving && <span style={{ color: '#38bdf8' }}>保存中...</span>}
            {errorMsg && <span style={{ color: '#f87171' }}>{errorMsg}</span>}
          </div>
        </div>

        {/* リスト */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.5rem' }}>
          {filteredSubIndustries.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
              一致する細分類が見つかりませんでした。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {filteredSubIndustries.map((opt) => {
                const isCurrent = currentSubIndustryId === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => !isSaving && handleSelect(opt)}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      backgroundColor: isCurrent ? 'rgba(59, 130, 246, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                      border: isCurrent ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.7)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.5)';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem' }}>
                          {opt.sub_industry_name}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                          ({opt.id})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                        {opt.sector_name} &gt; {opt.industry_group_name} &gt; {opt.industry_name}
                      </div>
                    </div>
                    {isCurrent && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#60a5fa', fontSize: '0.8rem', fontWeight: 600 }}>
                        <Check size={14} /> 現在
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
