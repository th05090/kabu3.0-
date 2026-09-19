'use client';

import React from 'react';
import { WatchlistStockDetail, WatchlistSource } from '../types';
import { WatchlistButton } from './WatchlistButton';
import { GICS_DICTIONARY } from '@/data/gics_dictionary';

interface WatchlistTableProps {
  items: WatchlistStockDetail[];
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
}

const SOURCE_LABELS: Record<WatchlistSource, { label: string; bg: string; color: string; border: string }> = {
  sepa: { label: 'SEPA', bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.4)' },
  screener: { label: 'スクリーナー', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.4)' },
  sector: { label: 'セクター流入', bg: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: 'rgba(6, 182, 212, 0.4)' },
  manual: { label: '手動追加', bg: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.4)' },
};

export function WatchlistTable({ items, selectedTicker, onSelectTicker }: WatchlistTableProps) {
  if (items.length === 0) {
    return (
      <div className="watchlist-empty-state">
        <p>ウォッチリストに登録された銘柄はありません。</p>
        <span>スクリーナーやSEPA、セクター画面の「★」をクリックして銘柄を追加してください。</span>
      </div>
    );
  }

  return (
    <div className="watchlist-table-wrapper">
      <table className="watchlist-table">
        <thead>
          <tr>
            <th style={{ width: '36px', textAlign: 'center' }}>★</th>
            <th>銘柄</th>
            <th>登録元</th>
            <th style={{ textAlign: 'right' }}>現在値</th>
            <th style={{ textAlign: 'right' }}>前日比</th>
            <th style={{ textAlign: 'right' }}>登録時 (日付)</th>
            <th style={{ textAlign: 'right' }}>登録来騰落</th>
            <th>状態</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isSelected = item.ticker === selectedTicker;
            const srcConfig = SOURCE_LABELS[item.source] || SOURCE_LABELS.manual;
            const gics = item.gics_sub_industry_id ? GICS_DICTIONARY[item.gics_sub_industry_id] : null;

            const isPositive = item.since_added_pct > 0;
            const isNegative = item.since_added_pct < 0;
            const returnColor = isPositive ? '#34d399' : isNegative ? '#fb7185' : '#94a3b8';

            const isDailyPos = item.daily_change_pct > 0;
            const isDailyNeg = item.daily_change_pct < 0;
            const dailyColor = isDailyPos ? '#34d399' : isDailyNeg ? '#fb7185' : '#94a3b8';

            return (
              <tr
                key={item.ticker}
                onClick={() => onSelectTicker(item.ticker)}
                className={`watchlist-row ${isSelected ? 'selected' : ''}`}
              >
                {/* 星ボタン */}
                <td style={{ textAlign: 'center', padding: '0.4rem 0.2rem' }}>
                  <WatchlistButton ticker={item.ticker} size={15} />
                </td>

                {/* 銘柄コード & 名前 */}
                <td style={{ minWidth: '150px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className="font-mono font-bold text-sky-400" style={{ fontSize: '0.8rem' }}>
                      {item.ticker.slice(0, 4)}
                    </span>
                    <span className="font-bold text-slate-100 truncate" style={{ maxWidth: '110px' }} title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem' }}>
                    {gics ? gics.sub_industry_name : item.industry}
                  </div>
                </td>

                {/* 登録元バッジ */}
                <td>
                  <span
                    className="watchlist-source-badge"
                    style={{
                      backgroundColor: srcConfig.bg,
                      color: srcConfig.color,
                      borderColor: srcConfig.border,
                    }}
                  >
                    {srcConfig.label}
                  </span>
                </td>

                {/* 現在値 */}
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#f1f5f9' }}>
                  {item.current_price.toLocaleString()}円
                </td>

                {/* 前日比 */}
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: dailyColor }}>
                  {isDailyPos ? '+' : ''}{item.daily_change_pct.toFixed(1)}%
                </td>

                {/* 登録時株価 ＆ 登録日 */}
                <td style={{ textAlign: 'right', fontSize: '0.72rem' }}>
                  <div style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>
                    {item.added_price.toLocaleString()}円
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
                    {item.added_date ? item.added_date.slice(5) : '-'}
                  </div>
                </td>

                {/* 登録来騰落率 */}
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: returnColor, fontSize: '0.85rem' }}>
                  {isPositive ? '+' : ''}{item.since_added_pct.toFixed(1)}%
                </td>

                {/* SEPA状態バッジ */}
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                    {item.is_pivot_breakout && (
                      <span className="watchlist-badge-breakout">ブレイク</span>
                    )}
                    {item.is_trend_template_pass ? (
                      <span className="watchlist-badge-stage2">Stage 2</span>
                    ) : (
                      <span className="watchlist-badge-neutral">調整中</span>
                    )}
                    {item.growth_status === 'TURNAROUND' && (
                      <span className="watchlist-badge-turnaround">黒字転換</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
