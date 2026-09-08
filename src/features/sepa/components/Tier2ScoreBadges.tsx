import React from 'react';
import { SepaFundamentalsMetrics } from '../types/sepa';

interface Tier2ScoreBadgesProps {
  stock: SepaFundamentalsMetrics;
  compact?: boolean;
}

export function Tier2ScoreBadges({ stock, compact = false }: Tier2ScoreBadgesProps) {
  const isAcc = Boolean(stock.is_growth_accelerating);
  const isMargin = Boolean(stock.is_margin_expanding);
  const is3Y = Boolean(stock.has_3y_annual_growth);
  const isRoe = stock.roe != null && stock.roe >= 15.0;

  const score = (isAcc ? 1 : 0) + (isMargin ? 1 : 0) + (is3Y ? 1 : 0) + (isRoe ? 1 : 0);

  let scoreStyle = {
    background: 'rgba(100, 116, 139, 0.2)',
    color: '#94a3b8',
    borderColor: 'rgba(100, 116, 139, 0.4)',
  };

  if (score === 4) {
    scoreStyle = {
      background: 'rgba(234, 179, 8, 0.25)',
      color: '#fbbf24',
      borderColor: 'rgba(234, 179, 8, 0.5)',
    };
  } else if (score === 3) {
    scoreStyle = {
      background: 'rgba(56, 189, 248, 0.2)',
      color: '#38bdf8',
      borderColor: 'rgba(56, 189, 248, 0.4)',
    };
  } else if (score === 2) {
    scoreStyle = {
      background: 'rgba(148, 163, 184, 0.15)',
      color: '#cbd5e1',
      borderColor: 'rgba(148, 163, 184, 0.3)',
    };
  }

  if (compact) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.2rem',
          padding: '0.1rem 0.4rem',
          borderRadius: '4px',
          fontSize: '0.65rem',
          fontWeight: 700,
          border: `1px solid ${scoreStyle.borderColor}`,
          background: scoreStyle.background,
          color: scoreStyle.color,
        }}
        title={`Tier 2スコア: ${score}/4 (加速:${isAcc ? '〇' : '×'}, 改善:${isMargin ? '〇' : '×'}, 3年:${is3Y ? '〇' : '×'}, ROE15%:${isRoe ? '〇' : '×'})`}
      >
        ★ {score}/4
      </span>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.15rem 0.4rem',
          borderRadius: '4px',
          fontSize: '0.68rem',
          fontWeight: 700,
          border: `1px solid ${scoreStyle.borderColor}`,
          background: scoreStyle.background,
          color: scoreStyle.color,
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}
        title="ミネルヴィニTier 2発展ファンダメンタルズ該当スコア (0〜4)"
      >
        {score === 4 ? '★ 4/4' : `${score}/4`}
      </span>

      <div style={{ display: 'inline-flex', gap: '0.15rem' }}>
        <span
          title="成長加速 (当期売上またはEPSが前期比加速、かつ足切り水準クリア)"
          style={{
            padding: '0.1rem 0.25rem',
            borderRadius: '3px',
            fontSize: '0.6rem',
            fontWeight: 600,
            background: isAcc ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            color: isAcc ? '#4ade80' : '#475569',
            border: isAcc ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid transparent',
          }}
        >
          加速
        </span>
        <span
          title="営業利益率改善 (最新Q営業利益率 > 前年同期)"
          style={{
            padding: '0.1rem 0.25rem',
            borderRadius: '3px',
            fontSize: '0.6rem',
            fontWeight: 600,
            background: isMargin ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            color: isMargin ? '#22d3ee' : '#475569',
            border: isMargin ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid transparent',
          }}
        >
          改善
        </span>
        <span
          title="3年連続年間増益 (株式分割調整後adj_eps、IPOバイパス対応)"
          style={{
            padding: '0.1rem 0.25rem',
            borderRadius: '3px',
            fontSize: '0.6rem',
            fontWeight: 600,
            background: is3Y ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            color: is3Y ? '#c084fc' : '#475569',
            border: is3Y ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid transparent',
          }}
        >
          3年
        </span>
        <span
          title="ROE 15%以上 (純資産ゼロ以下の債務超過は除外)"
          style={{
            padding: '0.1rem 0.25rem',
            borderRadius: '3px',
            fontSize: '0.6rem',
            fontWeight: 600,
            background: isRoe ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            color: isRoe ? '#fbbf24' : '#475569',
            border: isRoe ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid transparent',
          }}
        >
          ROE
        </span>
      </div>
    </div>
  );
}
