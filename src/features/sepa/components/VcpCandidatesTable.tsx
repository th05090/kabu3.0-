'use client';

import React from 'react';
import { SepaSortHeader } from './SepaSortHeader';
import { VcpCandidateRow } from './VcpCandidateRow';
import { SepaStockRecord } from '../types/sepa';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface VcpCandidatesTableProps {
  candidates: SepaStockRecord[];
  total: number;
  totalPages: number;
  page: number;
  isLoading: boolean;
  mode: string;
  selectedTicker: string | null;
  sortBy: string | null;
  order: 'asc' | 'desc';
  onSort: (field: string) => void;
  onSelectTicker: (ticker: string) => void;
  onPageChange: (newPage: number) => void;
}

export function VcpCandidatesTable({
  candidates,
  total,
  totalPages,
  page,
  isLoading,
  mode,
  selectedTicker,
  sortBy,
  order,
  onSort,
  onSelectTicker,
  onPageChange,
}: VcpCandidatesTableProps) {
  const isPullback21Ema = mode === 'stage2_pullback_21_ema' || mode === 'stage2_pullback_25';
  const isPullback50 = mode === 'stage2_pullback_50';
  const isBreakoutPullback = mode === 'breakout_pullback';
  const isPullback = isPullback21Ema || isPullback50;

  return (
    <div className="sepa-table-wrapper" style={{ minWidth: 0 }}>
      <table className="sepa-table">
        <thead>
          <tr>
            <SepaSortHeader field="ticker" currentSort={sortBy} currentOrder={order} onSort={onSort} align="left">
              銘柄
            </SepaSortHeader>
            <SepaSortHeader field="current_price" currentSort={sortBy} currentOrder={order} onSort={onSort} align="right">
              株価
            </SepaSortHeader>
            {isBreakoutPullback ? (
              <>
                <SepaSortHeader field="dist_ema21_pct" currentSort={sortBy} currentOrder={order} onSort={onSort} align="right">
                  MA乖離
                </SepaSortHeader>
                <SepaSortHeader field="days_since_breakout" currentSort={sortBy} currentOrder={order} onSort={onSort} align="right">
                  ブレイク / 調整
                </SepaSortHeader>
                <SepaSortHeader field="min_vdu_ratio" currentSort={sortBy} currentOrder={order} onSort={onSort} align="center">
                  出来高枯渇比
                </SepaSortHeader>
                <SepaSortHeader field="rs_rating" currentSort={sortBy} currentOrder={order} onSort={onSort} align="center">
                  RS
                </SepaSortHeader>
              </>
            ) : isPullback ? (
              <>
                <SepaSortHeader field={isPullback21Ema ? "dist_ema21_pct" : "dist_sma50_pct"} currentSort={sortBy} currentOrder={order} onSort={onSort} align="right">
                  {isPullback21Ema ? '21EMA乖離' : '50日線乖離'}
                </SepaSortHeader>
                <SepaSortHeader field="pullback_depth_pct" currentSort={sortBy} currentOrder={order} onSort={onSort} align="right">
                  押し幅
                </SepaSortHeader>
                <SepaSortHeader field="min_vdu_ratio" currentSort={sortBy} currentOrder={order} onSort={onSort} align="center">
                  出来高枯渇比
                </SepaSortHeader>
                <SepaSortHeader field="rs_rating" currentSort={sortBy} currentOrder={order} onSort={onSort} align="center">
                  RS
                </SepaSortHeader>
              </>
            ) : (
              <>
                <SepaSortHeader field="pivot_price" currentSort={sortBy} currentOrder={order} onSort={onSort} align="right">
                  ピボット
                </SepaSortHeader>
                <SepaSortHeader field="pivot_distance_pct" currentSort={sortBy} currentOrder={order} onSort={onSort} align="right">
                  接近度
                </SepaSortHeader>
                <SepaSortHeader field="atr_contraction_ratio" currentSort={sortBy} currentOrder={order} onSort={onSort} align="center">
                  ATR収縮
                </SepaSortHeader>
                <SepaSortHeader field="volume_dryup_ratio" currentSort={sortBy} currentOrder={order} onSort={onSort} align="center">
                  出来高枯渇
                </SepaSortHeader>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                読み込み中...
              </td>
            </tr>
          ) : candidates.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                候補が見つかりませんでした。
              </td>
            </tr>
          ) : (
            candidates.map((s: SepaStockRecord) => (
              <VcpCandidateRow
                key={s.ticker}
                stock={s}
                isSelected={selectedTicker === s.ticker}
                mode={mode}
                onSelect={() => onSelectTicker(s.ticker)}
              />
            ))
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.5rem 0.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {(page - 1) * 50 + 1} - {Math.min(page * 50, total)} 件 / 全 {total} 件
          </span>
          <div className="sepa-pagination" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            <span>{page} / {totalPages} ページ</span>
            <button
              disabled={page <= 1 || isLoading}
              onClick={() => onPageChange(page - 1)}
              className="sepa-page-btn"
              title="前のページ"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={page >= totalPages || isLoading}
              onClick={() => onPageChange(page + 1)}
              className="sepa-page-btn"
              title="次のページ"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
