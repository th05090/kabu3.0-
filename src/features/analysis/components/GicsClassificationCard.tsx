'use client';

import React, { useState, useMemo } from 'react';
import { Edit3, Check, Search, X, Layers } from 'lucide-react';
import { GICS_DICTIONARY, GICSClassification } from '@/data/gics_dictionary';

interface GicsClassificationCardProps {
  ticker: string;
  gicsInfo: GICSClassification | null;
  fallbackTheme?: string | null;
  onGicsChanged?: (newGics: GICSClassification) => void;
}

interface SubIndustryOption extends GICSClassification {
  id: string;
}

export const GicsClassificationCard: React.FC<GicsClassificationCardProps> = ({
  ticker,
  gicsInfo: propGicsInfo,
  fallbackTheme,
  onGicsChanged,
}) => {
  const [currentGics, setCurrentGics] = useState<GICSClassification | null>(propGicsInfo);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // GICS辞書を配列化（大分類・中分類・小分類・細分類コード順）
  const allSubIndustries = useMemo<SubIndustryOption[]>(() => {
    return Object.entries(GICS_DICTIONARY)
      .map(([id, val]) => ({
        id,
        ...val,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, []);

  // 検索クエリによるインクリメンタルフィルタ
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

  // 細分類選択とDB即時反映
  const handleSelectSubIndustry = async (option: SubIndustryOption) => {
    const prevGics = currentGics;
    setCurrentGics(option);
    setIsModalOpen(false);
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/stocks/${ticker}/gics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subIndustryId: option.id }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccess(true);
        onGicsChanged?.(option);
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        alert(`GICS分類の更新に失敗しました: ${data.error || '不明なエラー'}`);
        setCurrentGics(prevGics);
      }
    } catch (err: any) {
      console.error('Failed to update GICS:', err);
      alert('通信エラーが発生しました');
      setCurrentGics(prevGics);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bento-card">
      <div className="gics-card-header">
        <h2>分類情報</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {saveSuccess && (
            <span className="gics-save-badge">
              <Check size={12} />
              <span>DB保存完了</span>
            </span>
          )}
          {isSaving && (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>保存中...</span>
          )}
          <button
            onClick={() => {
              setSearchQuery('');
              setIsModalOpen(true);
            }}
            className="gics-edit-trigger-btn"
            title="GICS細分類を変更"
          >
            <Edit3 size={12} />
            <span>細分類を変更</span>
          </button>
        </div>
      </div>

      <div className="metric-row">
        <span className="metric-label">大分類 (主幹テーマ)</span>
        <span className="metric-value" style={{ color: 'var(--primary)' }}>
          {currentGics?.sector_name || fallbackTheme || '未分類'}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">中分類</span>
        <span className="metric-value">{currentGics?.industry_group_name || '-'}</span>
      </div>
      <div className="metric-row">
        <span className="metric-label">小分類</span>
        <span className="metric-value">{currentGics?.industry_name || '-'}</span>
      </div>
      <div className="metric-row">
        <span className="metric-label">細分類</span>
        <span
          className="metric-value"
          style={{
            fontSize: '0.9rem',
            textAlign: 'right',
            cursor: 'pointer',
            color: '#60a5fa',
          }}
          onClick={() => {
            setSearchQuery('');
            setIsModalOpen(true);
          }}
          title="クリックして細分類を選択"
        >
          {currentGics?.sub_industry_name || '未選択 (クリックして設定)'}
        </span>
      </div>

      {/* 細分類選択モーダル */}
      {isModalOpen && (
        <div className="gics-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="gics-modal" onClick={(e) => e.stopPropagation()}>
            {/* モーダルヘッダー */}
            <div className="gics-modal-header">
              <div className="gics-modal-title">
                <Layers size={18} style={{ color: '#38bdf8' }} />
                <span>GICS細分類の選択</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="gics-modal-close-btn"
                title="閉じる"
              >
                <X size={18} />
              </button>
            </div>

            {/* 検索入力欄 */}
            <div className="gics-modal-search-box">
              <div className="gics-search-input-wrapper">
                <Search size={16} />
                <input
                  type="text"
                  className="gics-search-input"
                  placeholder="細分類名、小分類、セクター名、コード(8桁)で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem', paddingLeft: '0.25rem' }}>
                候補: {filteredSubIndustries.length} 件 (クリックした時点で小・中・大分類を逆算し即座にDBへ反映されます)
              </div>
            </div>

            {/* 候補リスト */}
            <div className="gics-modal-list">
              {filteredSubIndustries.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  一致するGICS細分類が見つかりませんでした。
                </div>
              ) : (
                filteredSubIndustries.map((item) => {
                  const isCurrent = currentGics?.sub_industry_name === item.sub_industry_name;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSubIndustry(item)}
                      className={`gics-modal-item ${isCurrent ? 'active' : ''}`}
                    >
                      <div className="gics-item-main">
                        <div className="gics-item-subname">
                          <span>{item.sub_industry_name}</span>
                          <span className="gics-item-code">{item.id}</span>
                        </div>
                        <div className="gics-item-breadcrumb">
                          {item.sector_name} &gt; {item.industry_group_name} &gt; {item.industry_name}
                        </div>
                      </div>

                      {isCurrent && (
                        <div className="gics-item-selected-mark">
                          <Check size={14} />
                          <span>選択中</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
