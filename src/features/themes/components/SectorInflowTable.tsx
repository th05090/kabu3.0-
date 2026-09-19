'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUpDown, ChevronRight, Zap, BarChart3, CheckCircle2 } from 'lucide-react';
import { CategoryLevel, SectorInflowSummary, SectorViewMode } from '../sector_inflow_types';

interface SectorInflowTableProps {
  sectors: SectorInflowSummary[];
  onSelectSector: (sector: SectorInflowSummary) => void;
  categoryLevel?: CategoryLevel;
  viewMode?: SectorViewMode;
}

type SortField =
  | 'finalScore'
  | 'earlyScore'
  | 'stealthIndex'
  | 'ignitionRatio'
  | 'decouplingRatio'
  | 'leaderActionRatio'
  | 'turnoverShareDeltaPct'
  | 'netMfv'
  | 'groupAdRatio'
  | 'medianClv'
  | 'advanceRatio'
  | 'equalWeightReturn'
  | 'spreadEqVsCap'
  | 'volumeSurgeRatio'
  | 'rsDelta'
  | 'stockCount';

export const SectorInflowTable: React.FC<SectorInflowTableProps> = ({
  sectors,
  onSelectSector,
  categoryLevel = 'industry',
  viewMode = 'early',
}) => {
  const [sortField, setSortField] = useState<SortField>(viewMode === 'early' ? 'earlyScore' : 'finalScore');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    setSortField(viewMode === 'early' ? 'earlyScore' : 'finalScore');
    setSortAsc(false);
  }, [viewMode]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedSectors = [...sectors].sort((a, b) => {
    let valA = 0;
    let valB = 0;
    if (sortField === 'earlyScore') {
      valA = a.earlyRadar.earlyScore;
      valB = b.earlyRadar.earlyScore;
    } else if (sortField === 'stealthIndex') {
      valA = a.earlyRadar.stealthIndex;
      valB = b.earlyRadar.stealthIndex;
    } else if (sortField === 'ignitionRatio') {
      valA = a.earlyRadar.ignitionRatio;
      valB = b.earlyRadar.ignitionRatio;
    } else if (sortField === 'decouplingRatio') {
      valA = a.earlyRadar.decouplingRatio;
      valB = b.earlyRadar.decouplingRatio;
    } else if (sortField === 'leaderActionRatio') {
      valA = a.earlyRadar.leaderActionRatio;
      valB = b.earlyRadar.leaderActionRatio;
    } else {
      valA = a[sortField as keyof SectorInflowSummary] as number;
      valB = b[sortField as keyof SectorInflowSummary] as number;
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  return (
    <div className="sector-table-wrapper">
      <table className="sector-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort(viewMode === 'early' ? 'earlyScore' : 'finalScore')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span>{viewMode === 'early' ? '初動スコア' : 'トレンド'}</span>
                <ArrowUpDown size={12} />
              </div>
            </th>
            <th>進行段階</th>
            <th>{categoryLevel === 'industry_group' ? '業種グループ (GICS 4桁)' : '業種名 (GICS 6桁)'}</th>
            <th className="sortable text-right" onClick={() => handleSort('stockCount')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                <span>銘柄数</span>
                <ArrowUpDown size={12} />
              </div>
            </th>

            {viewMode === 'early' ? (
              <>
                <th className="sortable text-right" onClick={() => handleSort('stealthIndex')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>ステルス集積指数</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('ignitionRatio')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>出来高点火率</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('decouplingRatio')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>逆行耐性</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('leaderActionRatio')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>先導株アクション</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
              </>
            ) : (
              <>
                <th className="sortable text-right" onClick={() => handleSort('turnoverShareDeltaPct')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>シェア変化</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('netMfv')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>MFV</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('groupAdRatio')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>A/D比</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('equalWeightReturn')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>騰落率</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('volumeSurgeRatio')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>大商い率</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="sortable text-right" onClick={() => handleSort('rsDelta')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    <span>超過RS</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
              </>
            )}
            <th style={{ width: '32px' }}></th>
          </tr>
        </thead>
        <tbody>
          {sortedSectors.map((sector) => {
            const stage = sector.stageStatus;
            let badgeClass = 'sector-status-badge status-neutral';
            let badgeText = stage?.label || sector.status.label;

            if (stage?.variant === 'both_confluent') {
              badgeClass = 'sector-status-badge status-super';
              badgeText = '⚡📊 初動＋トレンド一致';
            } else if (stage?.variant === 'early_only') {
              badgeClass = 'sector-status-badge status-early';
              badgeText = '⚡ 初動兆候';
            } else if (stage?.variant === 'trend_only') {
              badgeClass = 'sector-status-badge status-lagging';
              badgeText = '📊 トレンド確認';
            }

            const currentScore = viewMode === 'early' ? sector.earlyRadar.earlyScore : sector.finalScore;
            let scoreColor = '#cbd5e1';
            let barColor = '#64748b';
            if (currentScore >= 80) {
              scoreColor = '#fbbf24';
              barColor = '#f59e0b';
            } else if (currentScore >= 65) {
              scoreColor = '#4ade80';
              barColor = '#22c55e';
            } else if (currentScore <= 44) {
              scoreColor = '#f87171';
              barColor = '#ef4444';
            }

            return (
              <tr
                key={sector.industryId}
                onClick={() => onSelectSector(sector)}
                className="clickable"
              >
                {/* スコア */}
                <td>
                  <div className="sector-score-cell">
                    <span style={{ color: scoreColor, width: '28px' }}>
                      {currentScore}
                    </span>
                    <div className="sector-score-bar-bg">
                      <div
                        className="sector-score-bar-fill"
                        style={{ width: `${currentScore}%`, background: barColor }}
                      />
                    </div>
                  </div>
                </td>

                {/* 進行段階バッジ */}
                <td>
                  <span className={badgeClass} title={stage?.description}>
                    {badgeText}
                  </span>
                </td>

                {/* 業種名 */}
                <td className="sector-name-cell">
                  <div style={{ fontWeight: 700, color: '#fff' }}>
                    {sector.industryName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', gap: '0.4rem' }}>
                    <span>{sector.sectorName}</span>
                    <span>•</span>
                    <span className="font-mono">{sector.industryId}</span>
                  </div>
                </td>

                {/* 構成銘柄数 */}
                <td className="text-right font-mono" style={{ color: '#94a3b8' }}>
                  {sector.stockCount}社
                </td>

                {viewMode === 'early' ? (
                  <>
                    {/* ステルス集積指数 */}
                    <td className="text-right font-mono font-bold" style={{ color: sector.earlyRadar.stealthIndex >= 0.5 ? '#fbbf24' : '#cbd5e1' }}>
                      {sector.earlyRadar.stealthIndex.toFixed(2)}
                    </td>

                    {/* 出来高点火率 */}
                    <td className="text-right font-mono font-bold" style={{ color: sector.earlyRadar.ignitionRatio > 0 ? '#4ade80' : '#94a3b8' }}>
                      {sector.earlyRadar.ignitionRatio}%
                    </td>

                    {/* 市場逆行耐性 */}
                    <td className="text-right font-mono font-bold" style={{ color: sector.earlyRadar.decouplingRatio >= 60 ? '#4ade80' : '#cbd5e1' }}>
                      {sector.earlyRadar.decouplingRatio}%
                    </td>

                    {/* 先導株アクション */}
                    <td className="text-right font-mono font-bold" style={{ color: sector.earlyRadar.leaderActionRatio >= 50 ? '#38bdf8' : '#cbd5e1' }}>
                      {sector.earlyRadar.leaderActionRatio}%
                    </td>
                  </>
                ) : (
                  <>
                    {/* 売買シェア変化 */}
                    <td className={`text-right font-mono font-bold ${sector.turnoverShareDeltaPct >= 0 ? 'text-green' : 'text-red'}`}>
                      {sector.turnoverShareDeltaPct >= 0 ? '+' : ''}{sector.turnoverShareDeltaPct}%
                    </td>

                    {/* 規格化 MFV */}
                    <td className={`text-right font-mono ${sector.netMfv >= 0 ? 'text-green' : 'text-red'}`}>
                      {sector.netMfv >= 0 ? '+' : ''}{sector.netMfv}
                    </td>

                    {/* グループ A/D レシオ */}
                    <td className="text-right font-mono" style={{ color: '#cbd5e1' }}>
                      {sector.groupAdRatio}
                    </td>

                    {/* 等ウェイト騰落率 */}
                    <td className={`text-right font-mono font-bold ${sector.equalWeightReturn >= 0 ? 'text-green' : 'text-red'}`}>
                      {sector.equalWeightReturn >= 0 ? '+' : ''}{sector.equalWeightReturn}%
                    </td>

                    {/* 出来高急増陽線比率 */}
                    <td className="text-right font-mono font-bold" style={{ color: '#fbbf24' }}>
                      {sector.volumeSurgeRatio}%
                    </td>

                    {/* 超過RS */}
                    <td className={`text-right font-mono font-bold ${sector.rsDelta >= 0 ? 'text-green' : 'text-red'}`}>
                      {sector.rsDelta >= 0 ? '+' : ''}{sector.rsDelta}%
                    </td>
                  </>
                )}

                {/* アクション */}
                <td style={{ textAlign: 'right', color: '#64748b' }}>
                  <ChevronRight size={16} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

