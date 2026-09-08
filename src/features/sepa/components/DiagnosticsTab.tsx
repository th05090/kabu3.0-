'use client';

import React, { useState } from 'react';
import { useSepaDiagnostics } from '../hooks/useSepa';
import { SepaPriceChart } from './SepaPriceChart';
import { RiskRewardPanel } from './RiskRewardPanel';
import { ChecklistBadges } from './ChecklistBadges';
import { Tier2ScoreBadges } from './Tier2ScoreBadges';
import { Search, Sparkles, AlertCircle, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { GICS_DICTIONARY } from '@/data/gics_dictionary';

interface DiagnosticsTabProps {
  initialTicker?: string | null;
}

export function DiagnosticsTab({ initialTicker }: DiagnosticsTabProps) {
  const [tickerInput, setTickerInput] = useState<string>(initialTicker || '72030');
  const [currentTicker, setCurrentTicker] = useState<string>(initialTicker || '72030');

  const { diagnostics, isLoading, error } = useSepaDiagnostics(currentTicker);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (tickerInput.trim()) {
      setCurrentTicker(tickerInput.trim());
    }
  };

  const m = diagnostics?.metrics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 銘柄検索バー */}
      <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '360px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} className="sepa-search-icon" />
          <input
            type="text"
            placeholder="銘柄コードを入力 (例: 72030, 69200)..."
            className="sepa-search-input"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="sepa-action-btn"
          style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '0.45rem 1rem', fontWeight: 600 }}
        >
          診断
        </button>
      </form>

      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>SEPA総合診断データを読み込み中...</div>
      ) : error || !m ? (
        <div className="sepa-card" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
          銘柄コード「{currentTicker}」のデータが見つかりませんでした。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 銘柄ヘッダーサマリー */}
          <div className="sepa-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>{m.name}</h2>
                <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#94a3b8' }}>{m.ticker}</span>
                {(() => {
                  const gics = m.gics_sub_industry_id ? GICS_DICTIONARY[m.gics_sub_industry_id] : null;
                  const tooltip = gics 
                    ? `GICS: ${gics.sector_name} > ${gics.industry_name} > ${gics.sub_industry_name}\n(東証33業種: ${m.industry})` 
                    : `東証33業種: ${m.industry}`;
                  return (
                    <span 
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: '#94a3b8' }}
                      title={tooltip}
                    >
                      <span style={{ color: gics ? '#38bdf8' : '#94a3b8', fontWeight: gics ? 500 : 400 }}>
                        {gics ? `${gics.sector_name} / ${gics.sub_industry_name}` : m.industry}
                      </span>
                      <span style={{ color: '#64748b' }}> | {m.market}</span>
                    </span>
                  );
                })()}
                {Boolean(m.is_ipo) && (
                  <span className="sepa-badge-ipo">
                    IPO
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                現在株価: <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{m.current_price.toLocaleString()}円</span> | 
                {m.base_high && m.base_high !== m.pivot_price && (
                  <>ベース高値: <span style={{ fontFamily: 'monospace', color: '#f97316', fontWeight: 600 }}>{m.base_high.toLocaleString()}円</span> | </>
                )}
                真のピボット: <span style={{ fontFamily: 'monospace', color: '#fbbf24', fontWeight: 700 }}>{m.pivot_price ? `${m.pivot_price.toLocaleString()}円` : '---'}</span> ({m.pivot_distance_pct != null ? `${m.pivot_distance_pct > 0 ? '+' : ''}${m.pivot_distance_pct.toFixed(1)}%` : '---'}) | 
                時価総額: <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{m.market_cap ? `${Math.round(m.market_cap).toLocaleString()}億円` : '---'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ textAlign: 'center', padding: '0.4rem 0.8rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>RSレーティング</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: m.rs_rating && m.rs_rating >= 80 ? '#818cf8' : '#fff' }}>
                  {m.rs_rating ?? '---'}
                  {Boolean(m.is_pseudo_rs) && <span style={{ fontSize: '0.75rem', color: '#fbbf24', marginLeft: '0.1rem' }}>*</span>}
                </span>
              </div>
              <div style={{ textAlign: 'center', padding: '0.4rem 0.8rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>トレンド条件</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: m.is_trend_template_pass ? '#34d399' : '#94a3b8' }}>
                  {m.passed_conditions_count} / 8
                </span>
              </div>
            </div>
          </div>

          {/* 3ペイン構成 */}
          <div className="sepa-diag-grid">
            {/* 1. トレンドテンプレート検証 */}
            <div className="sepa-card">
              <div className="sepa-card-header">
                <span>1. トレンドテンプレート (Stage 2)</span>
                {Boolean(m.is_trend_template_pass) ? (
                  <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700 }}>
                    <CheckCircle2 size={14} /> 合格
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <XCircle size={14} /> 未達
                  </span>
                )}
              </div>
              <ChecklistBadges trend={m} rs={m} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                <div className="sepa-info-row">
                  <span>200日SMAスロープ (22d):</span>
                  <span className="sepa-info-val" style={{ color: Number(m.sma_200_slope_22d) > 0 ? '#34d399' : '#f87171' }}>
                    {m.sma_200_slope_22d != null ? m.sma_200_slope_22d.toFixed(3) : '---'}
                  </span>
                </div>
                <div className="sepa-info-row">
                  <span>52週安値からの反発:</span>
                  <span className="sepa-info-val">+{Number(m.distance_from_low_52w_pct).toFixed(1)}%</span>
                </div>
                <div className="sepa-info-row">
                  <span>52週高値からの距離:</span>
                  <span className="sepa-info-val">{Number(m.distance_to_high_52w_pct).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* 2. 四半期単体ファンダメンタルズ */}
            <div className="sepa-card">
              <div className="sepa-card-header">
                <span>2. 四半期単体ファンダメンタルズ</span>
                <Tier2ScoreBadges stock={m} compact />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem' }}>
                <div className="sepa-info-row">
                  <span>売上高 YoY:</span>
                  <span className="sepa-info-val" style={{ color: m.sales_yoy_pct && m.sales_yoy_pct >= 10 ? '#34d399' : '#f1f5f9' }}>
                    {m.sales_yoy_pct ? `+${m.sales_yoy_pct.toFixed(1)}%` : '---'}
                  </span>
                </div>
                <div className="sepa-info-row">
                  <span>営業利益 YoY:</span>
                  <span className="sepa-info-val" style={{ color: m.op_yoy_pct && m.op_yoy_pct >= 20 ? '#34d399' : '#f1f5f9' }}>
                    {m.op_yoy_pct ? `+${m.op_yoy_pct.toFixed(1)}%` : '---'}
                  </span>
                </div>
                <div className="sepa-info-row">
                  <span>EPS YoY:</span>
                  <span className="sepa-info-val" style={{ color: m.eps_yoy_pct && m.eps_yoy_pct >= 20 ? '#34d399' : '#f1f5f9' }}>
                    {m.growth_status === 'TURNAROUND' ? (
                      <span style={{ color: '#818cf8' }}>黒字転換</span>
                    ) : m.eps_yoy_pct ? `+${m.eps_yoy_pct.toFixed(1)}%` : '---'}
                  </span>
                </div>
                <div className="sepa-info-row" style={{ paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span>成長の加速:</span>
                  <span style={{ color: Boolean(m.is_growth_accelerating) ? '#34d399' : '#64748b', fontWeight: Boolean(m.is_growth_accelerating) ? 700 : 500 }}>
                    {Boolean(m.is_growth_accelerating) ? '加速中 (加速あり)' : 'なし'}
                  </span>
                </div>
                <div className="sepa-info-row">
                  <span>営業利益率の改善:</span>
                  <span style={{ color: Boolean(m.is_margin_expanding) ? '#22d3ee' : '#64748b', fontWeight: Boolean(m.is_margin_expanding) ? 700 : 500 }}>
                    {Boolean(m.is_margin_expanding) ? '改善拡大' : '縮小/維持'}
                  </span>
                </div>
                <div className="sepa-info-row">
                  <span>過去3年通期成長:</span>
                  <span style={{ color: Boolean(m.has_3y_annual_growth) ? '#c084fc' : '#64748b' }}>
                    {Boolean(m.has_3y_annual_growth) ? '連続プラス成長' : '---'}
                  </span>
                </div>
                <div className="sepa-info-row">
                  <span>ROE:</span>
                  <span className="sepa-info-val" style={{ color: m.roe != null && m.roe >= 15 ? '#fbbf24' : '#f1f5f9' }}>
                    {m.roe != null ? `${m.roe.toFixed(1)}%` : '---'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. カタリスト (新規事業IR) */}
            <div className="sepa-card">
              <div className="sepa-card-header">
                <span>3. カタリスト (新規事業IR)</span>
                <span style={{ color: '#818cf8', fontWeight: 700 }}>
                  {diagnostics.irNews.length} 件
                </span>
              </div>
              {diagnostics.irNews.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: '#64748b', padding: '1rem 0', textAlign: 'center' }}>直近の新規事業IRニュースはありません。</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto' }}>
                  {diagnostics.irNews.map((ir: any) => (
                    <div key={ir.id} style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ir.title}</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.15rem' }}>{ir.date}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 日足チャート */}
          <div className="sepa-card">
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
              日足テクニカルチャート (50 / 150 / 200 SMA & ベース高値・ピボットライン)
            </h3>
            <SepaPriceChart
              quotes={diagnostics.quotes}
              pivotPrice={m.pivot_price}
              baseHigh={m.base_high}
            />
          </div>

          {/* リスクリワード計算機 */}
          <RiskRewardPanel
            currentPrice={m.current_price}
            pivotPrice={m.pivot_price}
            atr10={m.atr_10}
          />
        </div>
      )}
    </div>
  );
}
