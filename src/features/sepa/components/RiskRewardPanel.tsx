import React, { useState } from 'react';
import { ShieldAlert, Target, DollarSign } from 'lucide-react';

interface RiskRewardPanelProps {
  currentPrice: number;
  pivotPrice: number | null;
  atr10: number | null;
}

export function RiskRewardPanel({ currentPrice, pivotPrice, atr10 }: RiskRewardPanelProps) {
  const [entryPrice, setEntryPrice] = useState<number>(pivotPrice || currentPrice);
  const [stopLossPct, setStopLossPct] = useState<number>(7.0); // デフォルト7%

  const stopLossPrice = Math.round(entryPrice * (1 - stopLossPct / 100));
  const riskAmount = entryPrice - stopLossPrice;

  // 2 ATR 損切り
  const atrStopPrice = atr10 ? Math.round(entryPrice - atr10 * 2) : null;

  // 目標株価 (1:2, 1:3)
  const target1_2 = Math.round(entryPrice + riskAmount * 2);
  const target1_3 = Math.round(entryPrice + riskAmount * 3);

  return (
    <div className="sepa-sim-panel">
      <div className="sepa-sim-header">
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
          <ShieldAlert size={16} style={{ color: '#f43f5e' }} />
          ミネルヴィニ・リスク管理シミュレーター
        </h4>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>許容最大損失: -{stopLossPct}%</span>
      </div>

      <div className="sepa-sim-grid">
        <div>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>想定買付株価 (円)</label>
          <input
            type="number"
            className="sepa-sim-input"
            value={entryPrice}
            onChange={(e) => setEntryPrice(Number(e.target.value))}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>損切り幅 (%)</label>
          <select
            className="sepa-sim-input"
            value={stopLossPct}
            onChange={(e) => setStopLossPct(Number(e.target.value))}
          >
            <option value="5">厳格 5.0%</option>
            <option value="7">標準 7.0% (推奨)</option>
            <option value="8">最大 8.0%</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#f87171', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>逆指値 (損切り価格)</label>
          <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5' }}>
            {stopLossPrice.toLocaleString()} 円
            <span style={{ fontSize: '0.7rem', color: '#f87171', marginLeft: '0.3rem' }}>(-{riskAmount}円)</span>
          </div>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>2 ATR 損切り目安</label>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
            {atrStopPrice ? `${atrStopPrice.toLocaleString()} 円` : '---'}
          </div>
        </div>
      </div>

      <div className="sepa-target-box">
        <div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
            目標 1 (リスクリワード 1:2)
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>{target1_2.toLocaleString()} 円</span>
          <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'block', marginTop: '0.1rem' }}>(+{((target1_2 - entryPrice) / entryPrice * 100).toFixed(1)}%)</span>
        </div>
        <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.1)' }} />
        <div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
            目標 2 (リスクリワード 1:3)
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#818cf8' }}>{target1_3.toLocaleString()} 円</span>
          <span style={{ fontSize: '0.7rem', color: '#6366f1', display: 'block', marginTop: '0.1rem' }}>(+{((target1_3 - entryPrice) / entryPrice * 100).toFixed(1)}%)</span>
        </div>
      </div>
    </div>
  );
}
