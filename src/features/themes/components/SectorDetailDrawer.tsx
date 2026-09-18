'use client';

import React, { useState } from 'react';
import { X, ExternalLink, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { SectorInflowSummary } from '../sector_inflow_types';

interface SectorDetailDrawerProps {
  sector: SectorInflowSummary | null;
  onClose: () => void;
}

type SortField = 'returnRate' | 'dailyChangeRate' | 'volumeSurgeRatio' | 'clv' | 'rsRank' | 'marketCap';

function formatMarketCap(capInOku: number): string {
  if (!capInOku || capInOku <= 0) return '―';
  if (capInOku >= 10000) {
    return `${(capInOku / 10000).toFixed(1)}兆円`;
  }
  return `${Math.round(capInOku).toLocaleString()}億円`;
}


export const SectorDetailDrawer: React.FC<SectorDetailDrawerProps> = ({ sector, onClose }) => {
  const [sortField, setSortField] = useState<SortField>('returnRate');
  const [sortAsc, setSortAsc] = useState(false);

  if (!sector) return null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedStocks = [...sector.stocks].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    return sortAsc ? valA - valB : valB - valA;
  });

  return (
    <div className="sector-drawer-overlay" onClick={onClose}>
      <div className="sector-drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="sector-drawer-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="sector-inflow-pill" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.4)' }}>
                {sector.sectorName || 'GICS Industry'}
              </span>
              <span className="font-mono" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                コード: {sector.industryId}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                構成銘柄: {sector.stockCount}社
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.4rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>
                {sector.industryName}
              </h2>
              <span className="sector-top-score">
                {sector.status.label} ({sector.finalScore}点)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="sector-inflow-refresh-btn"
            style={{ padding: '0.5rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* サマリー指標バー */}
        <div className="sector-drawer-summary-bar">
          <div className="sector-drawer-stat">
            <span className="sector-drawer-stat-label">売買シェア変化</span>
            <span className={`sector-drawer-stat-val ${sector.turnoverShareDeltaPct >= 0 ? 'text-green' : 'text-red'}`}>
              {sector.turnoverShareDeltaPct >= 0 ? '+' : ''}{sector.turnoverShareDeltaPct}%
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: '0.3rem' }}>({sector.turnoverShareDeltaPt >= 0 ? '+' : ''}{sector.turnoverShareDeltaPt}pt)</span>
            </span>
          </div>
          <div className="sector-drawer-stat">
            <span className="sector-drawer-stat-label">規格化 MFV</span>
            <span className={`sector-drawer-stat-val ${sector.netMfv >= 0 ? 'text-green' : 'text-red'}`}>
              {sector.netMfv >= 0 ? '+' : ''}{sector.netMfv}
            </span>
          </div>
          <div className="sector-drawer-stat">
            <span className="sector-drawer-stat-label">等ウェイト騰落率</span>
            <span className={`sector-drawer-stat-val ${sector.equalWeightReturn >= 0 ? 'text-green' : 'text-red'}`}>
              {sector.equalWeightReturn >= 0 ? '+' : ''}{sector.equalWeightReturn}%
            </span>
          </div>
          <div className="sector-drawer-stat">
            <span className="sector-drawer-stat-label">等ウェイトSpread</span>
            <span className={`sector-drawer-stat-val ${sector.spreadEqVsCap >= 0 ? 'text-green' : 'text-red'}`}>
              {sector.spreadEqVsCap >= 0 ? '+' : ''}{sector.spreadEqVsCap}pt
            </span>
          </div>
        </div>

        {/* 銘柄一覧テーブル */}
        <div className="sector-drawer-table-area">
          <table className="sector-table">
            <thead>
              <tr>
                <th>状態バッジ</th>
                <th>銘柄</th>
                <th className="sortable text-right" onClick={() => handleSort('returnRate')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>期間騰落</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('dailyChangeRate')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>当日騰落</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('volumeSurgeRatio')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>出来高倍率</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('clv')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>CLV</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('rsRank')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>RS</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('marketCap')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>時価総額</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStocks.map((stock) => {
                const badge = stock.pullbackStatus.badge;
                return (
                  <tr key={stock.code}>
                    <td>
                      {badge.badgeType === 'trigger' && (
                        <span className="stock-pullback-badge badge-trigger">
                          {badge.label}
                        </span>
                      )}
                      {badge.badgeType === 'breakout' && (
                        <span className="stock-pullback-badge badge-breakout">
                          {badge.label}
                        </span>
                      )}
                      {badge.badgeType === 'pullback_21' && (
                        <span className="stock-pullback-badge badge-pullback-21">
                          {badge.label}
                        </span>
                      )}
                      {badge.badgeType === 'pullback_50' && (
                        <span className="stock-pullback-badge badge-pullback-50">
                          {badge.label}
                        </span>
                      )}
                      {badge.badgeType === 'none' && (
                        <span style={{ color: '#475569' }}>―</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/stocks/${stock.code}`}
                        target="_blank"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#60a5fa' }}
                      >
                        <span className="font-mono font-bold" style={{ color: '#fff' }}>
                          {stock.code}
                        </span>
                        <span className="truncate" style={{ maxWidth: '140px', color: '#cbd5e1' }}>
                          {stock.name}
                        </span>
                        <ExternalLink size={12} style={{ opacity: 0.6 }} />
                      </Link>
                    </td>
                    <td className={`text-right font-mono font-bold ${stock.returnRate >= 0 ? 'text-green' : 'text-red'}`}>
                      {stock.returnRate >= 0 ? '+' : ''}{stock.returnRate}%
                    </td>
                    <td className={`text-right font-mono ${stock.dailyChangeRate >= 0 ? 'text-green' : 'text-red'}`}>
                      {stock.dailyChangeRate >= 0 ? '+' : ''}{stock.dailyChangeRate}%
                    </td>
                    <td className="text-right font-mono" style={{ color: stock.volumeSurgeRatio >= 1.5 ? '#fbbf24' : '#94a3b8', fontWeight: stock.volumeSurgeRatio >= 1.5 ? 700 : 400 }}>
                      {stock.volumeSurgeRatio}x
                    </td>
                    <td className="text-right font-mono" style={{ color: '#cbd5e1' }}>
                      {stock.clv}
                    </td>
                    <td className="text-right font-mono font-bold" style={{ color: '#60a5fa' }}>
                      {stock.rsRank}
                    </td>
                    <td className="text-right font-mono" style={{ color: '#94a3b8' }}>
                      {formatMarketCap(stock.marketCap)}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

