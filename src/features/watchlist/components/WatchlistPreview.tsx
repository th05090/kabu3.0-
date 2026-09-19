'use client';

import React, { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { ExternalLink, Target, FileText, Check, Loader2 } from 'lucide-react';
import { WatchlistStockDetail } from '../types';
import { SepaPriceChart } from '@/features/sepa/components/SepaPriceChart';
import { GICS_DICTIONARY } from '@/data/gics_dictionary';

interface WatchlistPreviewProps {
  item: WatchlistStockDetail | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function WatchlistPreview({ item }: WatchlistPreviewProps) {
  const ticker = item?.ticker || null;

  // SEPA診断APIから日足quotesとメトリクスを取得
  const { data: sepaData, isLoading } = useSWR(
    ticker ? `/api/sepa/diagnostics/${ticker}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  // メモ状態管理
  const [notes, setNotes] = useState(item?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  useEffect(() => {
    setNotes(item?.notes || '');
  }, [item?.ticker, item?.notes]);

  if (!item) {
    return (
      <div className="watchlist-preview-empty">
        <Target size={36} className="text-slate-600 mb-2" />
        <p className="text-slate-400 text-sm">左の一覧から銘柄を選択してください。</p>
        <span className="text-slate-600 text-xs mt-1">
          日足チャート（21EMA/50SMA）とメモ編集パネルが展開されます。
        </span>
      </div>
    );
  }

  const handleSaveNotes = async () => {
    if (!ticker || isSavingNotes) return;
    setIsSavingNotes(true);
    try {
      await fetch(`/api/watchlist/${ticker}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 2000);
      mutate('/api/watchlist');
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const gics = item.gics_sub_industry_id ? GICS_DICTIONARY[item.gics_sub_industry_id] : null;
  const isReturnPos = item.since_added_pct > 0;
  const isReturnNeg = item.since_added_pct < 0;
  const returnColor = isReturnPos ? '#34d399' : isReturnNeg ? '#fb7185' : '#94a3b8';

  const isDailyPos = item.daily_change_pct > 0;
  const isDailyNeg = item.daily_change_pct < 0;
  const dailyColor = isDailyPos ? '#34d399' : isDailyNeg ? '#fb7185' : '#94a3b8';

  const quotes = sepaData?.quotes || [];
  const pivotPrice = sepaData?.metrics?.pivot_price || null;
  const baseHigh = sepaData?.metrics?.base_period_high || null;

  return (
    <div className="watchlist-preview-panel">
      {/* 銘柄ヘッダー */}
      <div className="watchlist-preview-header">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-sky-400">
                {item.ticker.slice(0, 4)}
              </span>
              <h2 className="text-base font-bold text-white">{item.name}</h2>
              <span className="text-xs text-slate-500">{item.market}</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {gics ? `${gics.sector_name} > ${gics.sub_industry_name}` : item.industry}
            </div>
          </div>

          <Link
            href={`/stocks/${item.ticker}`}
            className="watchlist-detail-link"
            title="個別銘柄詳細ページへ"
          >
            <span>詳細分析</span>
            <ExternalLink size={13} />
          </Link>
        </div>

        {/* 価格 & パフォーマンス情報グリッド */}
        <div className="watchlist-metrics-grid mt-3">
          <div className="watchlist-metric-card">
            <span className="watchlist-metric-title">現在株価</span>
            <div className="flex items-baseline gap-2">
              <span className="watchlist-metric-val font-mono">
                {item.current_price.toLocaleString()}円
              </span>
              <span className="text-xs font-mono font-bold" style={{ color: dailyColor }}>
                {isDailyPos ? '+' : ''}{item.daily_change_pct.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="watchlist-metric-card">
            <span className="watchlist-metric-title">登録時株価・日付</span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-slate-300 font-semibold">{item.added_price.toLocaleString()}円</span>
              <span className="text-slate-500 text-xs">({item.added_date})</span>
            </div>
          </div>

          <div className="watchlist-metric-card highlight">
            <span className="watchlist-metric-title">登録来騰落率</span>
            <span className="watchlist-metric-val font-mono text-lg font-bold" style={{ color: returnColor }}>
              {isReturnPos ? '+' : ''}{item.since_added_pct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* メモ編集エリア */}
      <div className="watchlist-notes-box">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
            <FileText size={13} className="text-amber-400" />
            <span>トレードメモ・狙い目</span>
          </div>
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={isSavingNotes}
            className="watchlist-save-notes-btn"
          >
            {isSavingNotes ? (
              <Loader2 size={12} className="animate-spin" />
            ) : isSavedRecently ? (
              <Check size={12} className="text-emerald-400" />
            ) : null}
            <span>{isSavedRecently ? '保存完了' : 'メモ保存'}</span>
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleSaveNotes}
          placeholder="例: 21EMA反発待ち。ピボット3,200円抜けで打診買い。損切り2,980円。"
          className="watchlist-notes-textarea"
          rows={2}
        />
      </div>

      {/* 日足チャートプレビュー */}
      <div className="watchlist-chart-container">
        <div className="watchlist-chart-title-bar">
          <span className="text-xs font-semibold text-slate-300">日足チャート (21EMA / 50SMA / 150 / 200)</span>
          {isLoading && <span className="text-xs text-slate-500 animate-pulse">チャート読み込み中...</span>}
        </div>
        <div className="watchlist-chart-wrapper">
          {quotes.length > 0 ? (
            <SepaPriceChart quotes={quotes} pivotPrice={pivotPrice} baseHigh={baseHigh} />
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-500">
              チャートデータがありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
