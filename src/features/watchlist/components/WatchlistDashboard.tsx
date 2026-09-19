'use client';

import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Bookmark, Plus, RefreshCw, Filter, Search } from 'lucide-react';
import { WatchlistStockDetail, WatchlistSource } from '../types';
import { WatchlistTable } from './WatchlistTable';
import { WatchlistPreview } from './WatchlistPreview';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function WatchlistDashboard() {
  const { data, error, isLoading } = useSWR<{ items: WatchlistStockDetail[] }>(
    '/api/watchlist',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const items = data?.items || [];

  // 選択銘柄
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  // 登録元フィルター
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // 手動追加フォーム
  const [inputTicker, setInputTicker] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // フィルター適用
  const filteredItems = items.filter((item) => {
    if (sourceFilter === 'all') return true;
    return item.source === sourceFilter;
  });

  // 選択中アイテム（未選択時はフィルタ後の先頭アイテムを自動選択）
  const activeTicker = selectedTicker || (filteredItems.length > 0 ? filteredItems[0].ticker : null);
  const activeItem = items.find((i) => i.ticker === activeTicker) || null;

  // 登録元別件数カウント
  const counts: Record<string, number> = {
    all: items.length,
    sepa: items.filter((i) => i.source === 'sepa').length,
    screener: items.filter((i) => i.source === 'screener').length,
    sector: items.filter((i) => i.source === 'sector').length,
  };

  const handleAddTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputTicker.trim();
    if (!raw) return;

    setIsAdding(true);
    setAddError(null);

    const ticker = raw.length === 4 ? `${raw}0` : raw;

    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, source: 'manual' }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddError(json.error || '追加に失敗しました');
      } else {
        setInputTicker('');
        setSelectedTicker(ticker);
        mutate('/api/watchlist');
        mutate('/api/watchlist?mode=tickers');
      }
    } catch (err: any) {
      setAddError('通信エラーが発生しました');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="watchlist-dashboard">
      {/* 画面トップバー */}
      <div className="watchlist-top-bar">
        <div className="flex items-center gap-2">
          <Bookmark size={20} className="text-amber-400" />
          <h1 className="text-lg font-bold text-white">ウォッチリスト</h1>
          <span className="text-xs text-slate-400 font-mono">({items.length}銘柄)</span>
        </div>

        {/* 銘柄直接追加バー */}
        <form onSubmit={handleAddTicker} className="watchlist-add-form">
          <input
            type="text"
            value={inputTicker}
            onChange={(e) => setInputTicker(e.target.value)}
            placeholder="銘柄コード (例: 7203)"
            className="watchlist-add-input"
            maxLength={5}
          />
          <button type="submit" disabled={isAdding || !inputTicker.trim()} className="watchlist-add-btn">
            <Plus size={14} />
            <span>追加</span>
          </button>
        </form>
      </div>

      {addError && <div className="watchlist-error-msg">{addError}</div>}

      {/* 登録元フィルターチップ */}
      <div className="watchlist-filter-bar">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
            <Filter size={12} />
            登録元:
          </span>
          <button
            type="button"
            onClick={() => setSourceFilter('all')}
            className={`watchlist-chip ${sourceFilter === 'all' ? 'active' : ''}`}
          >
            すべて ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('sepa')}
            className={`watchlist-chip chip-sepa ${sourceFilter === 'sepa' ? 'active' : ''}`}
          >
            SEPA ({counts.sepa})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('screener')}
            className={`watchlist-chip chip-screener ${sourceFilter === 'screener' ? 'active' : ''}`}
          >
            スクリーナー ({counts.screener})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('sector')}
            className={`watchlist-chip chip-sector ${sourceFilter === 'sector' ? 'active' : ''}`}
          >
            セクター流入 ({counts.sector})
          </button>
        </div>
      </div>

      {/* 左右2ペインスプリットレイアウト */}
      <div className="watchlist-split-container">
        {/* 左ペイン: 銘柄一覧テーブル */}
        <div className="watchlist-left-pane">
          {isLoading ? (
            <div className="watchlist-loading-state">
              <RefreshCw size={18} className="animate-spin text-slate-500 mb-2" />
              <span>読み込み中...</span>
            </div>
          ) : error ? (
            <div className="watchlist-error-state">データの取得に失敗しました</div>
          ) : (
            <WatchlistTable
              items={filteredItems}
              selectedTicker={activeTicker}
              onSelectTicker={(t) => setSelectedTicker(t)}
            />
          )}
        </div>

        {/* 右ペイン: チャート & メモプレビュー */}
        <div className="watchlist-right-pane">
          <WatchlistPreview item={activeItem} />
        </div>
      </div>
    </div>
  );
}
