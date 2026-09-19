'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2, XCircle, Info, Activity } from 'lucide-react';
import { MarketRegimeData } from '../market_regime_calculator';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function MarketRegimeIndicator() {
  const { data, error, isLoading } = useSWR<MarketRegimeData>('/api/market-regime', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const [isHovered, setIsHovered] = useState(false);

  if (isLoading || !data || error) {
    return (
      <div className="regime-badge-loading">
        <Activity size={13} className="animate-spin text-slate-400" />
        <span>地合い判定...</span>
      </div>
    );
  }

  const { status, statusLabel, actionGuide, date, metrics, checklist, redTriggers } = data;

  const getStatusColor = () => {
    switch (status) {
      case 'GREEN':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#34d399', dot: '#10b981' };
      case 'RED':
        return { bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e', text: '#fb7185', dot: '#f43f5e' };
      default:
        return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24', dot: '#f59e0b' };
    }
  };

  const colors = getStatusColor();

  return (
    <div
      className="regime-indicator-wrapper"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ヘッダー常駐バッジ */}
      <div
        className="regime-badge-pill"
        style={{
          background: colors.bg,
          borderColor: colors.border,
          color: colors.text,
        }}
      >
        <span className="regime-pulse-dot" style={{ backgroundColor: colors.dot }} />
        <span className="regime-badge-text">{statusLabel}</span>
      </div>

      {/* オンカーソル展開ポップオーバー */}
      {isHovered && (
        <div className="regime-popover">
          <div className="regime-popover-header">
            <div className="regime-popover-title">
              {status === 'GREEN' && <ShieldCheck size={18} className="text-emerald-400" />}
              {status === 'YELLOW' && <AlertTriangle size={18} className="text-amber-400" />}
              {status === 'RED' && <AlertOctagon size={18} className="text-rose-400" />}
              <span style={{ color: colors.text, fontWeight: 700 }}>
                市場地合い: {statusLabel} ({status})
              </span>
              <span className="regime-date-badge">{date}</span>
            </div>
            <div className="regime-action-box">
              <span className="regime-action-title">推奨アクション:</span>
              <span className="regime-action-text">{actionGuide}</span>
            </div>
          </div>

          <div className="regime-divider" />

          {/* 判定チェックリスト */}
          <div className="regime-checklist-section">
            <div className="regime-section-title">
              <Info size={13} />
              <span>🟢 良好条件チェック（全AND）</span>
            </div>
            <div className="regime-checklist-items">
              {Object.entries(checklist).map(([key, item]) => (
                <div key={key} className="regime-check-row">
                  <span className="regime-check-icon">
                    {item.pass ? (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    ) : (
                      <XCircle size={14} className="text-rose-400" />
                    )}
                  </span>
                  <span className="regime-check-label">{item.label}</span>
                  <span className={`regime-check-val ${item.pass ? 'pass' : 'fail'}`}>
                    {item.current}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 🔴 危険トリガー警告（該当がある場合） */}
          {status === 'RED' && (
            <>
              <div className="regime-divider" />
              <div className="regime-red-section">
                <div className="regime-section-title text-rose-400">
                  <AlertOctagon size={13} />
                  <span>🔴 発動した危険シグナル（単一OR）</span>
                </div>
                <div className="regime-red-items">
                  {Object.entries(redTriggers)
                    .filter(([, t]) => t.triggered)
                    .map(([key, t]) => (
                      <div key={key} className="regime-red-row">
                        <span className="regime-red-dot" />
                        <span>{t.label}</span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

          <div className="regime-divider" />

          <div className="regime-footer-note">
            <span>判定ルール: 🟢 良好=全AND / 🔴 不良=単一OR / 🟡 警戒=中間</span>
          </div>
        </div>
      )}
    </div>
  );
}
