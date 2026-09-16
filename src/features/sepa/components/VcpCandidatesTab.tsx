'use client';

import React, { useState } from 'react';
import { useSepaVcp, useSepaDiagnostics } from '../hooks/useSepa';
import { SepaPriceChart } from './SepaPriceChart';
import { SepaSortHeader } from './SepaSortHeader';
import { Tier2ScoreBadges } from './Tier2ScoreBadges';
import { Target, Activity, ExternalLink, CheckCircle2, Building2, Sparkles, Rocket } from 'lucide-react';
import { SepaStockRecord } from '../types/sepa';
import { GICS_DICTIONARY } from '@/data/gics_dictionary';

interface VcpCandidatesTabProps {
  onSelectTicker: (ticker: string) => void;
}

export function VcpCandidatesTab({ onSelectTicker }: VcpCandidatesTabProps) {
  const [mode, setMode] = useState<string>('strict_funda');
  const [excludeEtf, setExcludeEtf] = useState<boolean>(true);
  const [sweetSpotCap, setSweetSpotCap] = useState<boolean>(false);
  const [midLargeCap, setMidLargeCap] = useState<boolean>(false);
  const [minLiquidity, setMinLiquidity] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const { candidates, total, isLoading } = useSepaVcp(mode, page, 50, sortBy, order, excludeEtf, sweetSpotCap, minLiquidity, midLargeCap);
  const { diagnostics, isLoading: diagLoading } = useSepaDiagnostics(selectedTicker);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      if (order === 'desc') {
        setOrder('asc');
      } else {
        setSortBy(null);
        setOrder('desc');
      }
    } else {
      setSortBy(field);
      setOrder('desc');
    }
    setPage(1);
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    setPage(1);
    setSortBy(null);
    setOrder('desc');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* モード切替バー */}
      <div className="sepa-filter-box" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="sepa-btn-group">
          {/* 1. Stage2 + コア成長 (Tier 1) */}
          <button
            onClick={() => handleModeChange('strict_funda')}
            className={`sepa-chip ${mode === 'strict_funda' ? 'active-emerald' : ''}`}
            title="Stage 2（RS>=80）かつ 直近四半期EPS+20%以上（または黒字転換）かつ 直近四半期売上+10%以上のコア成長株"
          >
            <CheckCircle2 size={14} />
            Stage2 + コア成長 (Tier 1)
          </button>

          {/* 2. ★ Stage2 + 21EMA押し目 (紫/メイン) */}
          <button
            onClick={() => handleModeChange('stage2_pullback_21_ema')}
            className={`sepa-chip ${mode === 'stage2_pullback_21_ema' ? 'active-purple' : ''}`}
            title="構造的Stage 2（RS>=75）かつ 21日EMAサポート押し目（直近高値から調整 -3%〜-12%、乖離 -1.5%〜+3.5%、出来高枯渇）"
          >
            <Sparkles size={14} />
            ★ Stage2 + 21EMA押し目
          </button>

          {/* 3. Stage2 + 50日押し目 (シアン/サブ) */}
          <button
            onClick={() => handleModeChange('stage2_pullback_50')}
            className={`sepa-chip ${mode === 'stage2_pullback_50' ? 'active-cyan' : ''}`}
            title="構造的Stage 2（RS>=75）かつ 50日SMAサポート押し目（直近高値から調整 -5%〜-20%、乖離 -2.0%〜+3.5%、出来高枯渇）"
          >
            <Sparkles size={14} />
            Stage2 + 50日押し目
          </button>

          {/* 4. 🚀 ブレイク後押し目 (アンバー/新設) */}
          <button
            onClick={() => handleModeChange('breakout_pullback')}
            className={`sepa-chip ${mode === 'breakout_pullback' ? 'active-amber' : ''}`}
            title="過去3〜25営業日前に出来高急増でブレイクアウトし、現在25日線または50日線で健全な押し目を形成している銘柄 (RS>=75)"
          >
            <Rocket size={14} />
            🚀 ブレイク後押し目
          </button>

          {/* 5. 全VCP候補 (アンバー) */}
          <button
            onClick={() => handleModeChange('all')}
            className={`sepa-chip ${mode === 'all' ? 'active-amber' : ''}`}
            title="Stage 2合格かつ ピボット接近・出来高枯渇・ATR収縮のいずれかを満たす全候補"
          >
            <Activity size={14} />
            全VCP候補
          </button>

          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 0.25rem' }} />

          <button
            onClick={() => { setExcludeEtf(!excludeEtf); setPage(1); }}
            className={`sepa-chip ${excludeEtf ? 'active-purple' : ''}`}
            title="ETF、ETN、REIT、投資法人、投信等を除外して事業会社（株式）のみを表示"
          >
            <Building2 size={13} />
            株式のみ (投信除外)
          </button>

          <button
            onClick={() => {
              const next = !sweetSpotCap;
              setSweetSpotCap(next);
              if (next) setMidLargeCap(false);
              setPage(1);
            }}
            className={`sepa-chip ${sweetSpotCap ? 'active-amber' : ''}`}
            title="時価総額100〜1,000億円の中小型スイートスポット銘柄に限定"
          >
            時価総額 100〜1,000億
          </button>

          <button
            onClick={() => {
              const next = !midLargeCap;
              setMidLargeCap(next);
              if (next) setSweetSpotCap(false);
              setPage(1);
            }}
            className={`sepa-chip ${midLargeCap ? 'active-indigo' : ''}`}
            title="時価総額300〜3,000億円の中大型銘柄に限定"
          >
            時価総額 300〜3,000億
          </button>

          <button
            onClick={() => { setMinLiquidity(!minLiquidity); setPage(1); }}
            className={`sepa-chip ${minLiquidity ? 'active-blue' : ''}`}
            title="5日平均売買代金1億円以上"
          >
            売買代金 &gt;= 1億
          </button>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          該当: <span style={{ color: '#fff', fontWeight: 'bold' }}>{total.toLocaleString()}</span> 件
          <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>(クリックでチャート即時展開)</span>
        </div>
      </div>

      {/* 2ペイン分割: 左テーブル ＆ 右目視チャート */}
      <div className="sepa-split-layout">
        {/* 左: 銘柄一覧テーブル */}
        <div className="sepa-table-wrapper" style={{ minWidth: 0 }}>
          {(() => {
            const isPullback21Ema = mode === 'stage2_pullback_21_ema' || mode === 'stage2_pullback_25';
            const isPullback50 = mode === 'stage2_pullback_50';
            const isBreakoutPullback = mode === 'breakout_pullback';
            const isPullback = isPullback21Ema || isPullback50;

            return (
              <table className="sepa-table">
                <thead>
                  <tr>
                    <SepaSortHeader field="ticker" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="left">
                      銘柄
                    </SepaSortHeader>
                    <SepaSortHeader field="current_price" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="right">
                      株価
                    </SepaSortHeader>
                    {isBreakoutPullback ? (
                      <>
                        <SepaSortHeader field="dist_ema21_pct" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="right">
                          MA乖離
                        </SepaSortHeader>
                        <SepaSortHeader field="days_since_breakout" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="right">
                          ブレイク / 調整
                        </SepaSortHeader>
                        <SepaSortHeader field="min_vdu_ratio" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="center">
                          出来高枯渇比
                        </SepaSortHeader>
                        <SepaSortHeader field="rs_rating" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="center">
                          RS
                        </SepaSortHeader>
                      </>
                    ) : isPullback ? (
                      <>
                        <SepaSortHeader field={isPullback21Ema ? "dist_ema21_pct" : "dist_sma50_pct"} currentSort={sortBy} currentOrder={order} onSort={handleSort} align="right">
                          {isPullback21Ema ? '21EMA乖離' : '50日線乖離'}
                        </SepaSortHeader>
                        <SepaSortHeader field="pullback_depth_pct" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="right">
                          押し幅
                        </SepaSortHeader>
                        <SepaSortHeader field="min_vdu_ratio" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="center">
                          出来高枯渇比
                        </SepaSortHeader>
                        <SepaSortHeader field="rs_rating" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="center">
                          RS
                        </SepaSortHeader>
                      </>
                    ) : (
                      <>
                        <SepaSortHeader field="pivot_price" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="right">
                          ピボット
                        </SepaSortHeader>
                        <SepaSortHeader field="pivot_distance_pct" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="right">
                          接近度
                        </SepaSortHeader>
                        <SepaSortHeader field="atr_contraction_ratio" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="center">
                          ATR収縮
                        </SepaSortHeader>
                        <SepaSortHeader field="volume_dryup_ratio" currentSort={sortBy} currentOrder={order} onSort={handleSort} align="center">
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
                    candidates.map((s: SepaStockRecord) => {
                      const isSelected = selectedTicker === s.ticker;
                      const isTier1 = Boolean(
                        s.is_trend_template_pass &&
                        s.sales_yoy_pct != null && s.sales_yoy_pct >= 10.0 &&
                        ((s.eps_yoy_pct != null && s.eps_yoy_pct >= 20.0) || s.growth_status === 'TURNAROUND')
                      );

                      return (
                        <tr
                          key={s.ticker}
                          onClick={() => setSelectedTicker(s.ticker)}
                          className={isSelected ? 'selected' : ''}
                        >
                          <td style={{ minWidth: '170px' }}>
                            <div style={{ fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                {isTier1 && (
                                  <span className="sepa-badge-tier1" style={{ fontSize: '0.6rem', padding: '0.08rem 0.3rem', flexShrink: 0 }}>
                                    Tier 1
                                  </span>
                                )}
                              </div>
                              <Tier2ScoreBadges stock={s} compact />
                            </div>
                            {(() => {
                              const gics = s.gics_sub_industry_id ? GICS_DICTIONARY[s.gics_sub_industry_id] : null;
                              const tooltip = gics 
                                ? `GICS: ${gics.sector_name} > ${gics.industry_name} > ${gics.sub_industry_name}\n(東証33業種: ${s.industry})` 
                                : `東証33業種: ${s.industry}`;
                              return (
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={tooltip}>
                                  <span style={{ color: gics ? '#38bdf8' : '#94a3b8', fontWeight: gics ? 500 : 400 }}>
                                    {gics ? gics.sub_industry_name : s.industry}
                                  </span>
                                  <span style={{ color: '#64748b' }}> | RS {s.rs_rating}</span>
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {s.current_price.toLocaleString()}円
                          </td>

                          {isBreakoutPullback ? (
                            <>
                              {/* MA乖離 & サポート種別 */}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {(() => {
                                  const is21 = Boolean(s.is_pullback_21_ema);
                                  const dist = is21 ? s.dist_ema21_pct : s.dist_sma50_pct;
                                  const maVal = is21 ? s.ema_21 : s.sma_50;
                                  if (dist == null) return '---';
                                  const color = dist <= 0 ? '#34d399' : '#38bdf8';
                                  return (
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                                        <span style={{
                                          fontSize: '0.62rem',
                                          padding: '0.08rem 0.3rem',
                                          borderRadius: '4px',
                                          background: is21 ? 'rgba(168, 85, 247, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                                          border: is21 ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(6, 182, 212, 0.4)',
                                          color: is21 ? '#c084fc' : '#22d3ee',
                                          fontWeight: 700,
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {is21 ? '★ 21EMA' : '50MA'}
                                        </span>
                                        <span style={{ color, fontWeight: 700 }}>
                                          {dist > 0 ? `+${dist.toFixed(1)}%` : `${dist.toFixed(1)}%`}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.1rem' }}>
                                        {maVal ? `${maVal.toLocaleString()}円` : ''}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                              {/* ブレイク経過 & 高値調整 */}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                {s.days_since_breakout != null ? (
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                                      <span style={{
                                        padding: '0.08rem 0.3rem',
                                        fontSize: '0.65rem',
                                        borderRadius: '4px',
                                        background: 'rgba(245, 158, 11, 0.15)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        color: '#fbbf24',
                                        fontWeight: 700
                                      }}>
                                        {s.days_since_breakout}日前
                                      </span>
                                      <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                                        {s.pullback_from_breakout_high_pct != null ? `${s.pullback_from_breakout_high_pct}%` : '---'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                                      {s.breakout_date ? s.breakout_date.slice(5) : ''}
                                      {s.breakout_price ? ` (${s.breakout_price.toLocaleString()}円)` : ''}
                                    </div>
                                  </div>
                                ) : (
                                  '---'
                                )}
                              </td>
                              {/* 出来高枯渇比 */}
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {s.min_vdu_ratio != null ? (
                                  <span style={{
                                    padding: '0.15rem 0.4rem',
                                    fontSize: '0.65rem',
                                    borderRadius: '4px',
                                    background: s.min_vdu_ratio <= 0.75 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                                    border: s.min_vdu_ratio <= 0.75 ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                                    color: s.min_vdu_ratio <= 0.75 ? '#818cf8' : '#94a3b8',
                                    fontWeight: 600
                                  }}>
                                    {(s.min_vdu_ratio * 100).toFixed(0)}%
                                  </span>
                                ) : (
                                  '---'
                                )}
                              </td>
                              {/* RS */}
                              <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap', color: (s.rs_rating ?? 0) >= 80 ? '#34d399' : '#818cf8' }}>
                                {s.rs_rating ?? '---'}
                              </td>
                            </>
                          ) : isPullback ? (
                            <>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                {(() => {
                                  const dist = isPullback21Ema ? s.dist_ema21_pct : s.dist_sma50_pct;
                                  const maVal = isPullback21Ema ? s.ema_21 : s.sma_50;
                                  if (dist == null) return '---';
                                  const color = dist <= 0 ? '#34d399' : '#38bdf8';
                                  return (
                                    <div>
                                      <span style={{ color, fontWeight: 700 }}>
                                        {dist > 0 ? `+${dist.toFixed(1)}%` : `${dist.toFixed(1)}%`}
                                      </span>
                                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                                        {maVal ? `${maVal.toLocaleString()}円` : ''}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 600 }}>
                                {s.pullback_depth_pct != null ? `${s.pullback_depth_pct.toFixed(1)}%` : '---'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {s.min_vdu_ratio != null ? (
                                  <span style={{
                                    padding: '0.15rem 0.4rem',
                                    fontSize: '0.65rem',
                                    borderRadius: '4px',
                                    background: s.min_vdu_ratio <= 0.75 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                                    border: s.min_vdu_ratio <= 0.75 ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                                    color: s.min_vdu_ratio <= 0.75 ? '#818cf8' : '#94a3b8',
                                    fontWeight: 600
                                  }}>
                                    {(s.min_vdu_ratio * 100).toFixed(0)}%
                                  </span>
                                ) : (
                                  '---'
                                )}
                              </td>
                              <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: (s.rs_rating ?? 0) >= 80 ? '#34d399' : '#818cf8' }}>
                                {s.rs_rating ?? '---'}
                              </td>
                            </>
                          ) : (
                            <>
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
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            );
          })()}
        </div>

        {/* 右: 目視チャートプレビュー */}
        <div className="sepa-chart-panel">
          {selectedTicker && diagnostics ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {diagnostics.metrics.name} ({diagnostics.metrics.ticker})
                    {(() => {
                      const gics = diagnostics.metrics.gics_sub_industry_id ? GICS_DICTIONARY[diagnostics.metrics.gics_sub_industry_id] : null;
                      return (
                        <span 
                          style={{ fontSize: '0.75rem', fontWeight: 'normal', color: gics ? '#38bdf8' : '#94a3b8' }}
                          title={gics ? `東証33業種: ${diagnostics.metrics.industry}` : undefined}
                        >
                          {gics ? `${gics.sector_name} / ${gics.sub_industry_name}` : diagnostics.metrics.industry}
                        </span>
                      );
                    })()}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    {mode === 'breakout_pullback' ? (
                      <>
                        種別: <span style={{ color: diagnostics.metrics.is_pullback_21_ema ? '#c084fc' : '#22d3ee', fontWeight: 700 }}>
                          {diagnostics.metrics.is_pullback_21_ema ? '★ 21EMA押し目' : '50日押し目'}
                        </span> | 
                        ブレイク: <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                          {diagnostics.metrics.days_since_breakout != null ? `${diagnostics.metrics.days_since_breakout}日前 (${diagnostics.metrics.breakout_date})` : '---'}
                        </span> | 
                        高値調整: <span style={{ color: '#f97316', fontWeight: 600 }}>
                          {diagnostics.metrics.pullback_from_breakout_high_pct != null ? `${diagnostics.metrics.pullback_from_breakout_high_pct}%` : '---'}
                        </span> | 
                        MA乖離: <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                          {diagnostics.metrics.is_pullback_21_ema 
                            ? `${diagnostics.metrics.dist_ema21_pct != null && diagnostics.metrics.dist_ema21_pct > 0 ? '+' : ''}${diagnostics.metrics.dist_ema21_pct?.toFixed(1)}% (21EMA)`
                            : `${diagnostics.metrics.dist_sma50_pct != null && diagnostics.metrics.dist_sma50_pct > 0 ? '+' : ''}${diagnostics.metrics.dist_sma50_pct?.toFixed(1)}% (50MA)`}
                        </span> | 
                        枯渇比: <span style={{ color: '#818cf8', fontWeight: 600 }}>
                          {diagnostics.metrics.min_vdu_ratio != null ? `${(diagnostics.metrics.min_vdu_ratio * 100).toFixed(0)}%` : '---'}
                        </span> | 
                        RS: <span style={{ color: '#34d399', fontWeight: 700 }}>{diagnostics.metrics.rs_rating}</span>
                      </>
                    ) : mode === 'stage2_pullback_21_ema' || mode === 'stage2_pullback_25' || mode === 'stage2_pullback_50' ? (
                      <>
                        20日高値: <span style={{ color: '#f97316', fontWeight: 600 }}>{diagnostics.metrics.swing_high_20d ? `${diagnostics.metrics.swing_high_20d.toLocaleString()}円` : '---'}</span> | 
                        押し幅: <span style={{ color: '#fbbf24', fontWeight: 600 }}>{diagnostics.metrics.pullback_depth_pct != null ? `${diagnostics.metrics.pullback_depth_pct.toFixed(1)}%` : '---'}</span> | 
                        {mode === 'stage2_pullback_21_ema' || mode === 'stage2_pullback_25' ? (
                          <>21日EMA: <span style={{ color: '#a855f7', fontWeight: 700 }}>{diagnostics.metrics.ema_21 ? `${diagnostics.metrics.ema_21.toLocaleString()}円` : '---'} ({diagnostics.metrics.dist_ema21_pct != null ? `${diagnostics.metrics.dist_ema21_pct > 0 ? '+' : ''}${diagnostics.metrics.dist_ema21_pct.toFixed(1)}%` : '---'})</span> | </>
                        ) : (
                          <>50日SMA: <span style={{ color: '#06b6d4', fontWeight: 700 }}>{diagnostics.metrics.sma_50 ? `${diagnostics.metrics.sma_50.toLocaleString()}円` : '---'} ({diagnostics.metrics.dist_sma50_pct != null ? `${diagnostics.metrics.dist_sma50_pct > 0 ? '+' : ''}${diagnostics.metrics.dist_sma50_pct.toFixed(1)}%` : '---'})</span> | </>
                        )}
                        枯渇比: <span style={{ color: '#818cf8', fontWeight: 600 }}>{diagnostics.metrics.min_vdu_ratio != null ? `${(diagnostics.metrics.min_vdu_ratio * 100).toFixed(0)}%` : '---'}</span> | 
                        RS: <span style={{ color: '#34d399', fontWeight: 700 }}>{diagnostics.metrics.rs_rating}</span>
                      </>
                    ) : (
                      <>
                        {diagnostics.metrics.base_high && diagnostics.metrics.base_high !== diagnostics.metrics.pivot_price && (
                          <>ベース高値: <span style={{ color: '#f97316', fontWeight: 600 }}>{diagnostics.metrics.base_high.toLocaleString()}円</span> | </>
                        )}
                        真のピボット: <span style={{ color: '#fbbf24', fontWeight: 700 }}>{diagnostics.metrics.pivot_price?.toLocaleString()}円</span> | 
                        乖離: <span style={{ color: '#fff' }}>{diagnostics.metrics.pivot_distance_pct?.toFixed(1)}%</span> | 
                        RS: <span style={{ color: '#818cf8', fontWeight: 700 }}>{diagnostics.metrics.rs_rating}</span>
                      </>
                    )}
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
