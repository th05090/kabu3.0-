'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Search, FoldVertical, UnfoldVertical, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { TempGicsStockItem } from '../api/temp-gics/route';
import { TempIndustryAccordion } from './TempIndustryAccordion';
import { TempGicsModal } from './TempGicsModal';
import { GICSClassification } from '@/data/gics_dictionary';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface IndustryGroupData {
  industryId: string;
  industryName: string;
  sectorName: string;
  groupName: string;
  items: TempGicsStockItem[];
}

export default function TempGicsPage() {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    total: number;
    items: TempGicsStockItem[];
  }>('/api/temp-gics', fetcher, { revalidateOnFocus: false });

  const [searchQuery, setSearchQuery] = useState('');
  const [showUnclassifiedOnly, setShowUnclassifiedOnly] = useState(false);
  const [openIndustryIds, setOpenIndustryIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<TempGicsStockItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const rawItems = data?.items || [];

  // フィルタリング処理
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawItems.filter((item) => {
      if (showUnclassifiedOnly && !item.is_unclassified) return false;
      if (!q) return true;
      return (
        item.ticker.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.sub_industry_name.toLowerCase().includes(q) ||
        item.industry_name.toLowerCase().includes(q) ||
        item.sector_name.toLowerCase().includes(q)
      );
    });
  }, [rawItems, searchQuery, showUnclassifiedOnly]);

  // 小分類ごとのグルーピング
  const industryGroups = useMemo<IndustryGroupData[]>(() => {
    const map = new Map<string, IndustryGroupData>();

    for (const item of filteredItems) {
      const id = item.industry_id;
      let group = map.get(id);
      if (!group) {
        group = {
          industryId: id,
          industryName: item.industry_name,
          sectorName: item.sector_name,
          groupName: item.industry_group_name,
          items: [],
        };
        map.set(id, group);
      }
      group.items.push(item);
    }

    // ソート: 未分類を先頭または末尾に、他は小分類コード順
    return Array.from(map.values()).sort((a, b) => {
      if (a.industryId === '999999') return -1;
      if (b.industryId === '999999') return 1;
      return a.industryId.localeCompare(b.industryId);
    });
  }, [filteredItems]);

  // 開閉トグル
  const toggleIndustry = (id: string) => {
    setOpenIndustryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set(industryGroups.map((g) => g.industryId));
    setOpenIndustryIds(all);
  };

  const collapseAll = () => {
    setOpenIndustryIds(new Set());
  };

  // 細分類更新完了コールバック
  const handleUpdated = (newSubId: string, newGics: GICSClassification) => {
    if (!editingItem) return;
    const ticker = editingItem.ticker;

    // ローカルキャッシュ即時更新
    mutate((prev) => {
      if (!prev) return prev;
      const updated = prev.items.map((it) => {
        if (it.ticker === ticker) {
          return {
            ...it,
            sub_industry_id: newSubId,
            sub_industry_name: newGics.sub_industry_name,
            industry_id: newGics.industry_id,
            industry_name: newGics.industry_name,
            industry_group_id: newGics.industry_group_id,
            industry_group_name: newGics.industry_group_name,
            sector_id: newGics.sector_id,
            sector_name: newGics.sector_name,
            is_unclassified: false,
          };
        }
        return it;
      });
      return { ...prev, items: updated };
    }, false);

    setToastMsg(`${editingItem.name} を「${newGics.sub_industry_name}」に更新しました`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const unclassifiedCount = rawItems.filter((i) => i.is_unclassified).length;
  const classifiedCount = rawItems.length - unclassifiedCount;

  return (
    <div style={{ flex: 1, height: '100%', overflowY: 'auto', backgroundColor: '#0f172a' }}>
      <div style={{ padding: '1.5rem 2rem', maxWidth: '1200px', margin: '0 auto', color: '#f8fafc' }}>
      {/* 画面ヘッダー */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>GICS分類ディレクトリ（仮）</h1>
              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#facc15', fontWeight: 600 }}>
                確認・修正用
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.3rem', margin: 0 }}>
              小分類（6桁）ごとのドリルダウン一覧です。細分類名をクリックすると即座に修正・DB保存できます。
            </p>
          </div>

          {/* 統計バッジ */}
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <div style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem' }}>
              全銘柄: <strong>{rawItems.length}</strong>
            </div>
            <div style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.8rem' }}>
              分類済: <strong>{classifiedCount}</strong>
            </div>
            <div style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.8rem' }}>
              未分類: <strong>{unclassifiedCount}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ツールバー: 検索 & 一括開閉 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#0f172a', paddingTop: '0.5rem', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.4rem 0.8rem', width: '360px', maxWidth: '100%' }}>
          <Search size={16} style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="銘柄名、コード、小分類名で絞り込み..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowUnclassifiedOnly(!showUnclassifiedOnly)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', borderRadius: '6px',
              backgroundColor: showUnclassifiedOnly ? '#dc2626' : '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            <AlertTriangle size={14} />
            <span>未分類のみ</span>
          </button>
          <button
            type="button"
            onClick={expandAll}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            <UnfoldVertical size={14} />
            <span>すべて展開</span>
          </button>
          <button
            type="button"
            onClick={collapseAll}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            <FoldVertical size={14} />
            <span>すべて閉じる</span>
          </button>
          <button
            type="button"
            onClick={() => mutate()}
            title="再取得"
            style={{ padding: '0.4rem', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', cursor: 'pointer' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* トースト通知 */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', backgroundColor: '#065f46', border: '1px solid #10b981', color: '#ecfdf5', padding: '0.75rem 1.25rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 10000, fontSize: '0.85rem' }}>
          <CheckCircle2 size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* リスト本体 */}
      {isLoading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>全銘柄のGICSデータを読み込み中...</div>
      ) : industryGroups.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>条件に一致する銘柄・業種が見つかりませんでした。</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {industryGroups.map((group) => (
            <TempIndustryAccordion
              key={group.industryId}
              industryId={group.industryId}
              industryName={group.industryName}
              sectorName={group.sectorName}
              groupName={group.groupName}
              items={group.items}
              isOpen={openIndustryIds.has(group.industryId)}
              onToggle={() => toggleIndustry(group.industryId)}
              onEditClick={(item) => setEditingItem(item)}
            />
          ))}
        </div>
      )}

      {/* 編集モーダル */}
      {editingItem && (
        <TempGicsModal
          ticker={editingItem.ticker}
          stockName={editingItem.name}
          currentSubIndustryId={editingItem.sub_industry_id}
          currentSubIndustryName={editingItem.sub_industry_name}
          onClose={() => setEditingItem(null)}
          onUpdated={handleUpdated}
        />
      )}
      </div>
    </div>
  );
}
