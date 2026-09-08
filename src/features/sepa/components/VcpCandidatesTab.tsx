'use client';

import React, { useState } from 'react';
import { useSepaVcp, useSepaDiagnostics } from '../hooks/useSepa';
import { SepaPriceChart } from './SepaPriceChart';
import { Target, Zap, Activity, VolumeX, ExternalLink, CheckCircle2 } from 'lucide-react';
import { SepaStockRecord } from '../types/sepa';

interface VcpCandidatesTabProps {
  onSelectTicker: (ticker: string) => void;
}

export function VcpCandidatesTab({ onSelectTicker }: VcpCandidatesTabProps) {
  const [mode, setMode] = useState<string>('near_pivot');
  const [page, setPage] = useState<number>(1);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const { candidates, total, isLoading } = useSepaVcp(mode, page, 50);
  const { diagnostics, isLoading: diagLoading } = useSepaDiagnostics(selectedTicker);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* モード切替バー */}
      <div className="sepa-filter-box" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="sepa-btn-group">
          <button
            onClick={() => { setMode('near_pivot'); setPage(1); }}
            className={`sepa-chip ${mode === 'near_pivot' ? 'active-amber' : ''}`}
          >
            <Target size={14} />
            ピボット接近 (-5%〜0%)
          </button>
          <button
            onClick={() => { setMode('breakout'); setPage(1); }}
            className={`sepa-chip ${mode === 'breakout' ? 'active-green' : ''}`}
          >
            <Zap size={14} />
            ブレイク直後 (出来高急増)
          </button>
          <button
            onClick={() => { setMode('vdu_dryup'); setPage(1); }}
            className={`sepa-chip ${mode === 'vdu_dryup' ? 'active-indigo' : ''}`}
          >
            <VolumeX size={14} />
            出来高枯渇 (VDU &lt; 60%)
          </button>
          <button
            onClick={() => { setMode('strict_funda'); setPage(1); }}
            className={`sepa-chip ${mode === 'strict_funda' ? 'active-purple' : ''}`}
          >
            <CheckCircle2 size={14} />
            Stage2 + 全ファンダ
          </button>
          <button
            onClick={() => { setMode('all'); setPage(1); }}
            className={`sepa-chip ${mode === 'all' ? 'active-neutral' : ''}`}
          >
            <Activity size={14} />
            全VCP候補
          </button>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          該当: <span style={{ color: '#fff', fontWeight: 'bold' }}>{total.toLocaleString()}</span> 件
          <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>(クリックでチャート即時展開)</span>
        </div>
      </div>

      {/* 2ペイン分割: 左テーブル ＆ 右目視チャート */}
      <div className="sepa-split-layout">
        {/* 左: 候補テーブル */}
        <div className="sepa-table-wrapper" style={{ maxHeight: '620px' }}>
          <table className="sepa-table">
            <thead>
              <tr>
                <th>銘柄</th>
                <th style={{ textAlign: 'right' }}>株価</th>
                <th style={{ textAlign: 'right' }}>ピボット</th>
                <th style={{ textAlign: 'right' }}>接近度</th>
                <th style={{ textAlign: 'center' }}>ATR収縮</th>
                <th style={{ textAlign: 'center' }}>出来高枯渇</th>
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
                candidates.map((s: SepaStockRecord) => {
                  const isSelected = selectedTicker === s.ticker;

                  return (
                    <tr
                      key={s.ticker}
                      onClick={() => setSelectedTicker(s.ticker)}
                      className={isSelected ? 'selected' : ''}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{s.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{s.ticker} | RS {s.rs_rating}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                        {s.current_price.toLocaleString()}円
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 600 }}>
                        {s.pivot_price ? `${s.pivot_price.toLocaleString()}円` : '---'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {s.pivot_distance_pct != null ? (
                          <span
                            style={{
                              color: s.pivot_distance_pct >= 0 && s.pivot_distance_pct <= 3 ? '#34d399' : '#fbbf24',
                              fontWeight: s.pivot_distance_pct >= 0 && s.pivot_distance_pct <= 3 ? 700 : 500
                            }}
                          >
                            {s.pivot_distance_pct > 0 ? `+${s.pivot_distance_pct.toFixed(1)}%` : `${s.pivot_distance_pct.toFixed(1)}%`}
                          </span>
                        ) : (
                          '---'
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {s.is_volatility_contracted ? (
                          <span className="sepa-badge-pass">
                            収縮 ({Number(s.atr_contraction_ratio).toFixed(2)})
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{s.atr_contraction_ratio ? s.atr_contraction_ratio.toFixed(2) : '---'}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {s.is_volume_dryup ? (
                          <span style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#818cf8', fontWeight: 600 }}>
                            枯渇 (VDU)
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{s.volume_dryup_ratio ? s.volume_dryup_ratio.toFixed(2) : '---'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 右: 目視チャートプレビュー */}
        <div className="sepa-chart-panel">
          {selectedTicker && diagnostics ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {diagnostics.metrics.name} ({diagnostics.metrics.ticker})
                    <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#94a3b8' }}>{diagnostics.metrics.industry}</span>
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    {diagnostics.metrics.base_high && diagnostics.metrics.base_high !== diagnostics.metrics.pivot_price && (
                      <>ベース高値: <span style={{ color: '#f97316', fontWeight: 600 }}>{diagnostics.metrics.base_high.toLocaleString()}円</span> | </>
                    )}
                    真のピボット: <span style={{ color: '#fbbf24', fontWeight: 700 }}>{diagnostics.metrics.pivot_price?.toLocaleString()}円</span> | 
                    乖離: <span style={{ color: '#fff' }}>{diagnostics.metrics.pivot_distance_pct?.toFixed(1)}%</span> | 
                    RS: <span style={{ color: '#818cf8', fontWeight: 700 }}>{diagnostics.metrics.rs_rating}</span>
                  </div>
                </div>
                <button
                  onClick={() => onSelectTicker(selectedTicker)}
                  className="sepa-action-btn"
                >
                  詳細診断
                  <ExternalLink size={12} />
                </button>
              </div>

              {diagLoading ? (
                <div style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>チャート読み込み中...</div>
              ) : (
                <SepaPriceChart
                  quotes={diagnostics.quotes}
                  pivotPrice={diagnostics.metrics.pivot_price}
                  baseHigh={diagnostics.metrics.base_high}
                />
              )}
            </div>
          ) : (
            <div className="sepa-chart-empty">
              <Target size={36} style={{ color: '#475569' }} />
              <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>左の候補一覧から銘柄をクリックすると、ここに日足チャートとピボットラインが展開されます。</p>
              <p style={{ fontSize: '0.75rem', color: '#64748b' }}>（波の収縮回数やハンドルの浅さを目視で確認してください）</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
