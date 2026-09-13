'use client';

import React, { useState } from 'react';
import { ArrowUpDown, ChevronRight } from 'lucide-react';
import { CategoryLevel, SectorInflowSummary } from '../sector_inflow_types';

interface SectorInflowTableProps {
  sectors: SectorInflowSummary[];
  onSelectSector: (sector: SectorInflowSummary) => void;
  categoryLevel?: CategoryLevel;
}

type SortField =
  | 'finalScore'
  | 'turnoverShareDeltaPct'
  | 'netMfv'
  | 'groupAdRatio'
  | 'medianClv'
  | 'advanceRatio'
  | 'equalWeightReturn'
  | 'spreadEqVsCap'
  | 'volumeSurgeRatio'
  | 'rsDelta'
  | 'breakoutRatio'
  | 'stockCount';

export const SectorInflowTable: React.FC<SectorInflowTableProps> = ({
  sectors,
  onSelectSector,
  categoryLevel = 'industry',
}) => {
  const [sortField, setSortField] = useState<SortField>('finalScore');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedSectors = [...sectors].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    return sortAsc ? valA - valB : valB - valA;
  });

  return (
    <div className="sector-table-wrapper">
      <table className="sector-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort('finalScore')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span>スコア</span>
                <ArrowUpDown size={12} />
              </div>
            </th>
            <th>状態判定</th>
            <th>{categoryLevel === 'industry_group' ? '業種グループ (GICS 4桁)' : '業種名 (GICS 6桁)'}</th>
            <th className="sortable text-right" onClick={() => handleSort('stockCount')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                <span>銘柄数</span>
                <ArrowUpDown size={12} />
              </div>
            </th>
            <th className="sortable text-right" onClick={() => handleSort('turnoverShareDeltaPct')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                <span>シェア変化</span>
                <ArrowUpDown size={12} />
              </div>
            </th>
            <th className="sortable text-right" onClick={() => handleSort('netMfv')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                <span>規格化 MFV</span>
                <ArrowUpDown size={12} />
              </div>
            </th>
            <th className="sortable text-right" onClick={() => handleSort('groupAdRatio')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                <span>A/D比</span>
                <ArrowUpDown size={12} />
              </div>
            </th>
            <th className="sortable text-right" onClick={() => handleSort('medianClv')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                <span>CLV</span>
                <ArrowUpDown size={12} />
              </div>
            </th>
            <th className="sortable text-right" onClick={() => handleSort('equalWeightReturn')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                <span>騰落率</span>
                <ArrowUpDown size={12} />
              </div>
            </th>
            <th className="sortable text-right" onClick={() => handleSort('spreadEqVsCap')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                <span>Spread</span>
                <ArrowUpDown size={12} />
              </div>
            </th>
            <th className="sortable text-right" onClick={() => handleSort('advanceRatio')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                <span>上昇率</span>
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
            <th style={{ width: '32px' }}></th>
          </tr>
        </thead>
        <tbody>
          {sortedSectors.map((sector) => {
            const status = sector.status;
            let badgeClass = 'sector-status-badge status-neutral';
            if (status.variant === 'super') badgeClass = 'sector-status-badge status-super';
            else if (status.variant === 'early') badgeClass = 'sector-status-badge status-early';
            else if (status.variant === 'lagging') badgeClass = 'sector-status-badge status-lagging';
            else if (status.variant === 'defensive') badgeClass = 'sector-status-badge status-defensive';
            else if (status.variant === 'outflow') badgeClass = 'sector-status-badge status-outflow';

            let scoreColor = '#cbd5e1';
            let barColor = '#64748b';
            if (sector.finalScore >= 80) {
              scoreColor = '#fbbf24';
              barColor = '#f59e0b';
            } else if (sector.finalScore >= 65) {
              scoreColor = '#4ade80';
              barColor = '#22c55e';
            } else if (sector.finalScore <= 44) {
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
                      {sector.finalScore}
                    </span>
                    <div className="sector-score-bar-bg">
                      <div
                        className="sector-score-bar-fill"
                        style={{ width: `${sector.finalScore}%`, background: barColor }}
                      />
                    </div>
                  </div>
                </td>

                {/* 状態バッジ */}
                <td>
                  <span className={badgeClass}>{status.label}</span>
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

                {/* グループ CLV 中央値 */}
                <td className="text-right font-mono" style={{ color: '#cbd5e1' }}>
                  {sector.medianClv}
                </td>

                {/* 等ウェイト騰落率 */}
                <td className={`text-right font-mono font-bold ${sector.equalWeightReturn >= 0 ? 'text-green' : 'text-red'}`}>
                  {sector.equalWeightReturn >= 0 ? '+' : ''}{sector.equalWeightReturn}%
                </td>

                {/* 等ウェイト vs 加重 Spread */}
                <td className={`text-right font-mono ${sector.spreadEqVsCap >= 0 ? 'text-green' : 'text-red'}`}>
                  {sector.spreadEqVsCap >= 0 ? '+' : ''}{sector.spreadEqVsCap}pt
                </td>

                {/* セクター騰落ブレッドス */}
                <td className="text-right font-mono" style={{ color: '#cbd5e1' }}>
                  {sector.advanceRatio}%
                </td>

                {/* 出来高急増陽線比率 */}
                <td className="text-right font-mono font-bold" style={{ color: '#fbbf24' }}>
                  {sector.volumeSurgeRatio}%
                </td>

                {/* 超過RS */}
                <td className={`text-right font-mono font-bold ${sector.rsDelta >= 0 ? 'text-green' : 'text-red'}`}>
                  {sector.rsDelta >= 0 ? '+' : ''}{sector.rsDelta}%
                </td>

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

