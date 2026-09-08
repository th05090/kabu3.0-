'use client';

import React, { useState } from 'react';
import { useSepaTrend } from '../hooks/useSepa';
import { TrendFilterControls } from './TrendFilterControls';
import { ChecklistBadges } from './ChecklistBadges';
import { ChevronLeft, ChevronRight, AlertTriangle, Sparkles, ExternalLink } from 'lucide-react';
import { SepaStockRecord } from '../types/sepa';

interface TrendTemplateTabProps {
  onSelectTicker: (ticker: string) => void;
}

export function TrendTemplateTab({ onSelectTicker }: TrendTemplateTabProps) {
  const [page, setPage] = useState<number>(1);
  const [filter, setFilter] = useState<string>('all_pass');
  const [minRs, setMinRs] = useState<number | null>(80);
  const [accelerating, setAccelerating] = useState<boolean>(true);
  const [marginExpansion, setMarginExpansion] = useState<boolean>(true);
  const [sweetSpotCap, setSweetSpotCap] = useState<boolean>(true);
  const [minLiquidity, setMinLiquidity] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const { stocks, total, totalPages, isLoading } = useSepaTrend({
    page,
    limit: 50,
    filter,
    min_rs: minRs,
    accelerating,
    margin_expansion: marginExpansion,
    sweet_spot_cap: sweetSpotCap,
    min_liquidity: minLiquidity,
    search: search.length >= 2 ? search : undefined,
  });

  const handleReset = () => {
    setFilter('all_pass');
    setMinRs(80);
    setAccelerating(true);
    setMarginExpansion(true);
    setSweetSpotCap(true);
    setMinLiquidity(true);
    setSearch('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <TrendFilterControls
        filter={filter}
        setFilter={(f) => { setFilter(f); setPage(1); }}
        minRs={minRs}
        setMinRs={(rs) => { setMinRs(rs); setPage(1); }}
        accelerating={accelerating}
        setAccelerating={(b) => { setAccelerating(b); setPage(1); }}
        marginExpansion={marginExpansion}
        setMarginExpansion={(b) => { setMarginExpansion(b); setPage(1); }}
        sweetSpotCap={sweetSpotCap}
        setSweetSpotCap={(b) => { setSweetSpotCap(b); setPage(1); }}
        minLiquidity={minLiquidity}
        setMinLiquidity={(b) => { setMinLiquidity(b); setPage(1); }}
        search={search}
        setSearch={(s) => { setSearch(s); setPage(1); }}
        onReset={handleReset}
      />

      {/* ヘッダー情報 ＆ ページネーション */}
      <div className="sepa-table-meta">
        <div>
          該当銘柄数: <span style={{ fontWeight: 'bold', color: '#fff' }}>{total.toLocaleString()}</span> 件
          {filter === 'all_pass' && <span style={{ marginLeft: '0.5rem', color: '#34d399', fontWeight: 600 }}>(Stage 2 上昇トレンド確定銘柄)</span>}
        </div>
        <div className="sepa-pagination">
          <span>{page} / {totalPages} ページ</span>
          <button
            disabled={page <= 1 || isLoading}
            onClick={() => setPage(p => p - 1)}
            className="sepa-page-btn"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage(p => p + 1)}
            className="sepa-page-btn"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* テーブル本体 */}
      <div className="sepa-table-wrapper">
        <table className="sepa-table">
          <thead>
            <tr>
              <th>銘柄コード・企業名</th>
              <th style={{ textAlign: 'right' }}>現在株価</th>
              <th style={{ textAlign: 'center' }}>RS順位</th>
              <th>トレンド条件 (8条件)</th>
              <th style={{ textAlign: 'center' }}>掲載日 (Stage2突入)</th>
              <th style={{ textAlign: 'right' }}>四半期売上YoY</th>
              <th style={{ textAlign: 'right' }}>四半期EPS YoY</th>
              <th style={{ textAlign: 'right' }}>時価総額</th>
              <th style={{ textAlign: 'center' }}>診断</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  データを読み込み中...
                </td>
              </tr>
            ) : stocks.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  条件に合致する銘柄が見つかりませんでした。
                </td>
              </tr>
            ) : (
              stocks.map((s: SepaStockRecord) => {
                const isIpo = Boolean(s.is_ipo);

                return (
                  <tr
                    key={s.ticker}
                    onClick={() => onSelectTicker(s.ticker)}
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {s.name}
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>{s.ticker}</span>
                        {isIpo && (
                          <span className="sepa-badge-ipo">
                            IPO
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>{s.industry} | {s.market}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                      {s.current_price.toLocaleString()} 円
                      <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>
                        高値{Number(s.distance_to_high_52w_pct).toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {s.rs_rating != null ? (
                        <span
                          className={`sepa-badge-rs ${
                            s.is_pseudo_rs
                              ? 'rs-pseudo'
                              : s.rs_rating >= 80
                              ? 'rs-high'
                              : 'rs-normal'
                          }`}
                          title={s.is_pseudo_rs ? '上場期間が短いため直近期間で算出した擬似RS' : '東証全銘柄パーセンタイル'}
                        >
                          {s.rs_rating}
                          {s.is_pseudo_rs && '*'}
                        </span>
                      ) : (
                        <span style={{ color: '#475569' }}>---</span>
                      )}
                    </td>
                    <td>
                      <ChecklistBadges trend={s} rs={s} />
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {s.stage2_entry_date ? (
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f1f5f9', fontSize: '0.75rem' }}>
                            {s.stage2_entry_date}
                          </span>
                          {(() => {
                            const entry = new Date(s.stage2_entry_date);
                            const now = new Date(s.latest_date);
                            const diffDays = Math.round((now.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
                            return (
                              <span style={{ fontSize: '0.65rem', color: diffDays <= 7 ? '#34d399' : '#94a3b8', display: 'block' }}>
                                {diffDays === 0 ? '本日突入' : `${diffDays}日前`}
                              </span>
                            );
                          })()}
                        </div>
                      ) : (
                        <span style={{ color: '#475569' }}>---</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {s.sales_yoy_pct != null ? (
                        <span style={{ color: s.sales_yoy_pct >= 15 ? '#34d399' : '#cbd5e1', fontWeight: s.sales_yoy_pct >= 15 ? 700 : 500 }}>
                          {s.sales_yoy_pct > 0 ? `+${s.sales_yoy_pct.toFixed(1)}%` : `${s.sales_yoy_pct.toFixed(1)}%`}
                        </span>
                      ) : (
                        <span style={{ color: '#475569' }}>---</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {s.growth_status === 'TURNAROUND' ? (
                        <span style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', fontWeight: 700, borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#818cf8' }}>
                          黒字転換
                        </span>
                      ) : s.eps_yoy_pct != null ? (
                        <span style={{ color: s.eps_yoy_pct >= 20 ? '#34d399' : '#cbd5e1', fontWeight: s.eps_yoy_pct >= 20 ? 700 : 500 }}>
                          {s.eps_yoy_pct > 0 ? `+${s.eps_yoy_pct.toFixed(1)}%` : `${s.eps_yoy_pct.toFixed(1)}%`}
                        </span>
                      ) : (
                        <span style={{ color: '#475569' }}>---</span>
                      )}
                      {Boolean(s.has_accounting_noise_risk) && (
                        <span title="売上伴わない利益急増" style={{ marginLeft: '0.25rem', color: '#fbbf24' }}>⚠️</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#cbd5e1' }}>
                      {s.market_cap ? `${Math.round(s.market_cap).toLocaleString()} 億` : '---'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectTicker(s.ticker); }}
                        className="sepa-action-btn"
                      >
                        診断
                        <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
