'use client';

import React from 'react';
import { SepaStockRecord } from '../types/sepa';
import { Tier2ScoreBadges } from './Tier2ScoreBadges';
import { GICS_DICTIONARY } from '@/data/gics_dictionary';
import { WatchlistButton } from '@/features/watchlist/components/WatchlistButton';

interface VcpCandidateRowProps {
  stock: SepaStockRecord;
  isSelected: boolean;
  mode: string;
  onSelect: () => void;
}

export function VcpCandidateRow({ stock: s, isSelected, mode, onSelect }: VcpCandidateRowProps) {
  const isPullback21Ema = mode === 'stage2_pullback_21_ema' || mode === 'stage2_pullback_25';
  const isPullback50 = mode === 'stage2_pullback_50';
  const isBreakoutPullback = mode === 'breakout_pullback';
  const isPullback = isPullback21Ema || isPullback50;

  const isTier1 = Boolean(
    s.is_trend_template_pass &&
    s.sales_yoy_pct != null && s.sales_yoy_pct >= 10.0 &&
    ((s.eps_yoy_pct != null && s.eps_yoy_pct >= 20.0) || s.growth_status === 'TURNAROUND')
  );

  return (
    <tr onClick={onSelect} className={isSelected ? 'selected' : ''}>
      <td style={{ minWidth: '170px' }}>
        <div style={{ fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <WatchlistButton ticker={s.ticker} source="sepa" size={14} />
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
                      {is21 ? '21EMA' : '50MA'}
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
                  color: s.pivot_distance_pct >= 0 && s.pivot_distance_pct <= 5 ? '#34d399' : '#fbbf24',
                  fontWeight: s.pivot_distance_pct >= 0 && s.pivot_distance_pct <= 5 ? 700 : 500
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
}
