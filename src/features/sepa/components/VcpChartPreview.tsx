'use client';

import React from 'react';
import { Target, ExternalLink } from 'lucide-react';
import { SepaPriceChart } from './SepaPriceChart';
import { SepaStockRecord } from '../types/sepa';
import { GICS_DICTIONARY } from '@/data/gics_dictionary';

interface SepaDiagnosticsData {
  metrics: SepaStockRecord;
  quotes: any[];
  irNews?: any[];
  financials?: any[];
}

interface VcpChartPreviewProps {
  selectedTicker: string | null;
  mode: string;
  diagnostics?: SepaDiagnosticsData | null;
  isLoading: boolean;
  onOpenDetails: (ticker: string) => void;
}

export function VcpChartPreview({
  selectedTicker,
  mode,
  diagnostics,
  isLoading,
  onOpenDetails,
}: VcpChartPreviewProps) {
  if (!selectedTicker || !diagnostics) {
    return (
      <div className="sepa-chart-panel">
        <div className="sepa-chart-empty">
          <Target size={36} style={{ color: '#475569' }} />
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            左の候補一覧から銘柄をクリックすると、ここに日足チャートとピボットラインが展開されます。
          </p>
          <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
            （波の収縮回数やハンドルの浅さを目視で確認してください）
          </p>
        </div>
      </div>
    );
  }

  const { metrics, quotes } = diagnostics;
  const gics = metrics.gics_sub_industry_id ? GICS_DICTIONARY[metrics.gics_sub_industry_id] : null;

  return (
    <div className="sepa-chart-panel">
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {metrics.name} ({metrics.ticker})
              <span 
                style={{ fontSize: '0.75rem', fontWeight: 'normal', color: gics ? '#38bdf8' : '#94a3b8' }}
                title={gics ? `東証33業種: ${metrics.industry}` : undefined}
              >
                {gics ? `${gics.sector_name} / ${gics.sub_industry_name}` : metrics.industry}
              </span>
            </h3>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              {mode === 'breakout_pullback' ? (
                <>
                  種別: <span style={{ color: metrics.is_pullback_21_ema ? '#c084fc' : '#22d3ee', fontWeight: 700 }}>
                    {metrics.is_pullback_21_ema ? '21EMA押し目' : '50日押し目'}
                  </span> | 
                  ブレイク: <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                    {metrics.days_since_breakout != null ? `${metrics.days_since_breakout}日前 (${metrics.breakout_date})` : '---'}
                  </span> | 
                  高値調整: <span style={{ color: '#f97316', fontWeight: 600 }}>
                    {metrics.pullback_from_breakout_high_pct != null ? `${metrics.pullback_from_breakout_high_pct}%` : '---'}
                  </span> | 
                  MA乖離: <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                    {metrics.is_pullback_21_ema 
                      ? `${metrics.dist_ema21_pct != null && metrics.dist_ema21_pct > 0 ? '+' : ''}${metrics.dist_ema21_pct?.toFixed(1)}% (21EMA)`
                      : `${metrics.dist_sma50_pct != null && metrics.dist_sma50_pct > 0 ? '+' : ''}${metrics.dist_sma50_pct?.toFixed(1)}% (50MA)`}
                  </span> | 
                  枯渇比: <span style={{ color: '#818cf8', fontWeight: 600 }}>
                    {metrics.min_vdu_ratio != null ? `${(metrics.min_vdu_ratio * 100).toFixed(0)}%` : '---'}
                  </span> | 
                  RS: <span style={{ color: '#34d399', fontWeight: 700 }}>{metrics.rs_rating}</span>
                </>
              ) : mode === 'stage2_pullback_21_ema' || mode === 'stage2_pullback_25' || mode === 'stage2_pullback_50' ? (
                <>
                  20日高値: <span style={{ color: '#f97316', fontWeight: 600 }}>{metrics.swing_high_20d ? `${metrics.swing_high_20d.toLocaleString()}円` : '---'}</span> | 
                  押し幅: <span style={{ color: '#fbbf24', fontWeight: 600 }}>{metrics.pullback_depth_pct != null ? `${metrics.pullback_depth_pct.toFixed(1)}%` : '---'}</span> | 
                  {mode === 'stage2_pullback_21_ema' || mode === 'stage2_pullback_25' ? (
                    <>21日EMA: <span style={{ color: '#a855f7', fontWeight: 700 }}>{metrics.ema_21 ? `${metrics.ema_21.toLocaleString()}円` : '---'} ({metrics.dist_ema21_pct != null ? `${metrics.dist_ema21_pct > 0 ? '+' : ''}${metrics.dist_ema21_pct.toFixed(1)}%` : '---'})</span> | </>
                  ) : (
                    <>50日SMA: <span style={{ color: '#06b6d4', fontWeight: 700 }}>{metrics.sma_50 ? `${metrics.sma_50.toLocaleString()}円` : '---'} ({metrics.dist_sma50_pct != null ? `${metrics.dist_sma50_pct > 0 ? '+' : ''}${metrics.dist_sma50_pct.toFixed(1)}%` : '---'})</span> | </>
                  )}
                  枯渇比: <span style={{ color: '#818cf8', fontWeight: 600 }}>{metrics.min_vdu_ratio != null ? `${(metrics.min_vdu_ratio * 100).toFixed(0)}%` : '---'}</span> | 
                  RS: <span style={{ color: '#34d399', fontWeight: 700 }}>{metrics.rs_rating}</span>
                </>
              ) : (
                <>
                  {metrics.base_high && metrics.base_high !== metrics.pivot_price && (
                    <>ベース高値: <span style={{ color: '#f97316', fontWeight: 600 }}>{metrics.base_high.toLocaleString()}円</span> | </>
                  )}
                  真のピボット: <span style={{ color: '#fbbf24', fontWeight: 700 }}>{metrics.pivot_price?.toLocaleString()}円</span> | 
                  乖離: <span style={{ color: '#fff' }}>{metrics.pivot_distance_pct?.toFixed(1)}%</span> | 
                  RS: <span style={{ color: '#818cf8', fontWeight: 700 }}>{metrics.rs_rating}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => onOpenDetails(selectedTicker)}
            className="sepa-action-btn"
          >
            詳細診断
            <ExternalLink size={12} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            チャート読み込み中...
          </div>
        ) : (
          <SepaPriceChart
            quotes={quotes}
            pivotPrice={metrics.pivot_price}
            baseHigh={metrics.base_high}
          />
        )}
      </div>
    </div>
  );
}
