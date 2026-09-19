'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Layers, RefreshCw, AlertCircle, Zap, BarChart3, CheckCircle2 } from 'lucide-react';
import {
  CategoryLevel,
  InflowPeriod,
  SectorInflowApiResponse,
  SectorInflowSummary,
  SectorViewMode,
} from '../sector_inflow_types';
import { SectorInflowTable } from './SectorInflowTable';
import { SectorDetailDrawer } from './SectorDetailDrawer';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const SectorInflowTab: React.FC = () => {
  const [viewMode, setViewMode] = useState<SectorViewMode>('early');
  const [period, setPeriod] = useState<InflowPeriod>(20);
  const [categoryLevel, setCategoryLevel] = useState<CategoryLevel>('industry');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [minStocks, setMinStocks] = useState<number>(5);
  const [selectedSector, setSelectedSector] = useState<SectorInflowSummary | null>(null);

  const { data, error, isLoading, mutate } = useSWR<SectorInflowApiResponse>(
    `/api/themes/sector-inflow?period=${period}&level=${categoryLevel}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const sectors = data?.sectors || [];

  // フィルタリング処理
  const filteredSectors = useMemo(() => {
    return sectors.filter((sec) => {
      if (sec.stockCount < minStocks) return false;
      if (stageFilter === 'BOTH' && sec.stageStatus.variant !== 'both_confluent') return false;
      if (stageFilter === 'EARLY' && sec.stageStatus.variant !== 'early_only' && sec.stageStatus.variant !== 'both_confluent') return false;
      if (stageFilter === 'TREND' && sec.stageStatus.variant !== 'trend_only' && sec.stageStatus.variant !== 'both_confluent') return false;
      return true;
    });
  }, [sectors, minStocks, stageFilter]);

  // モードに応じたソート済みトップ3業種
  const topSectors = useMemo(() => {
    const sorted = [...sectors];
    if (viewMode === 'early') {
      sorted.sort((a, b) => b.earlyRadar.earlyScore - a.earlyRadar.earlyScore);
    } else {
      sorted.sort((a, b) => b.trendScore - a.trendScore);
    }
    return sorted.slice(0, 3);
  }, [sectors, viewMode]);

  return (
    <div className="sector-inflow-container">
      {/* 画面説明・タイトルエリア */}
      <div className="sector-inflow-header-card">
        <div className="sector-inflow-header-top">
          <div>
            <div className="sector-inflow-badge">
              <Layers size={14} />
              <span>GICS Inflow Radar</span>
            </div>
            <div className="sector-inflow-title">
              <span>セクター資金流入確認ツール</span>
              <span className="sector-inflow-pill">
                {categoryLevel === 'industry_group' ? 'GICS 4桁業種グループ' : 'GICS 6桁業種'}
              </span>
            </div>
            <p className="sector-inflow-desc">
              「⚡ 先行初動レーダー（水面下の商い急増・逆行耐性）」と「📊 トレンド確認（資金集中・ブレッドス・新高値）」の2つの視点から、相場の進行段階（初動 ➔ トレンド ➔ 両方一致）を客観的に可視化します。
            </p>
          </div>

          {/* 右上操作群: 表示モード切替 & 分類・期間 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
            {/* メイン視点切替トグル */}
            <div className="sector-inflow-window-tabs" style={{ background: 'rgba(30, 41, 59, 0.8)', padding: '3px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <button
                onClick={() => setViewMode('early')}
                className={`sector-inflow-window-btn ${viewMode === 'early' ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: viewMode === 'early' ? 700 : 500 }}
              >
                <Zap size={13} style={{ color: '#eab308' }} />
                <span>先行初動レーダー</span>
              </button>
              <button
                onClick={() => setViewMode('trend')}
                className={`sector-inflow-window-btn ${viewMode === 'trend' ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: viewMode === 'trend' ? 700 : 500 }}
              >
                <BarChart3 size={13} style={{ color: '#38bdf8' }} />
                <span>トレンド確認</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className="sector-inflow-window-tabs">
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0 0.5rem' }}>分類:</span>
                <button
                  onClick={() => setCategoryLevel('industry')}
                  className={`sector-inflow-window-btn ${categoryLevel === 'industry' ? 'active' : ''}`}
                >
                  業種 (6桁)
                </button>
                <button
                  onClick={() => setCategoryLevel('industry_group')}
                  className={`sector-inflow-window-btn ${categoryLevel === 'industry_group' ? 'active' : ''}`}
                >
                  グループ (4桁)
                </button>
              </div>

              <div className="sector-inflow-window-tabs">
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0 0.5rem' }}>期間:</span>
                {[
                  { id: 20 as InflowPeriod, label: '20日' },
                  { id: 5 as InflowPeriod, label: '5日' },
                  { id: 60 as InflowPeriod, label: '60日' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    className={`sector-inflow-window-btn ${period === p.id ? 'active' : ''}`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => mutate()}
                  title="データを再取得"
                  className="sector-inflow-refresh-btn"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* トップ流入業種ハイライトカード */}
        {topSectors.length > 0 && (
          <div className="sector-inflow-top-cards">
            {topSectors.map((sec, idx) => (
              <div
                key={sec.industryId}
                onClick={() => setSelectedSector(sec)}
                className="sector-inflow-top-card"
              >
                <div className="sector-top-header">
                  <span className="sector-top-rank">
                    {viewMode === 'early' ? `⚡ #${idx + 1} 初動上位` : `📊 #${idx + 1} トレンド上位`}
                  </span>
                  <span className="sector-top-score">
                    {viewMode === 'early' ? `${sec.earlyRadar.earlyScore}点` : `${sec.trendScore}点`}
                  </span>
                </div>
                <div className="sector-top-name">{sec.industryName}</div>
                <div className="sector-top-metrics">
                  {viewMode === 'early' ? (
                    <>
                      <span>ステルス: <strong>{sec.earlyRadar.stealthIndex}</strong></span>
                      <span>逆行耐性: <strong>{sec.earlyRadar.decouplingRatio}%</strong></span>
                    </>
                  ) : (
                    <>
                      <span>
                        シェア変化:{' '}
                        <span className={sec.turnoverShareDeltaPct >= 0 ? 'text-green' : 'text-red'}>
                          {sec.turnoverShareDeltaPct >= 0 ? '+' : ''}{sec.turnoverShareDeltaPct}%
                        </span>
                      </span>
                      <span>
                        騰落:{' '}
                        <span className={sec.equalWeightReturn >= 0 ? 'text-green' : 'text-red'}>
                          {sec.equalWeightReturn >= 0 ? '+' : ''}{sec.equalWeightReturn}%
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* フィルターバー */}
      <div className="sector-inflow-filter-bar">
        <div className="sector-filter-buttons">
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '0.25rem' }}>進行段階絞込:</span>
          {[
            { id: 'ALL', label: 'すべて' },
            { id: 'BOTH', label: '⚡📊 初動＋トレンド一致' },
            { id: 'EARLY', label: '⚡ 初動兆候 (Q1)' },
            { id: 'TREND', label: '📊 トレンド確認 (Q1)' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStageFilter(item.id)}
              className={`sector-filter-btn ${stageFilter === item.id ? 'active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 最小構成銘柄数スライダー */}
        <div className="sector-slider-box">
          <span style={{ color: '#94a3b8' }}>最小構成銘柄数:</span>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={minStocks}
            onChange={(e) => setMinStocks(Number(e.target.value))}
          />
          <span className="font-mono font-bold" style={{ color: '#fff', width: '45px' }}>
            {minStocks}社以上
          </span>
        </div>
      </div>

      {/* テーブル本体 / ローディング・エラー */}
      {isLoading ? (
        <div style={{ padding: '4rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: '#3b82f6', margin: '0 auto 0.75rem auto' }} />
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>全3,100銘柄の日足データからGICS業種資金フローを集計中...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}>
          <AlertCircle size={28} style={{ margin: '0 auto 0.5rem auto' }} />
          <p style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>集計データの取得に失敗しました</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>{error?.message || 'エラーが発生しました'}</p>
        </div>
      ) : filteredSectors.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px solid var(--border)', color: '#94a3b8' }}>
          条件に合致する業種がありませんでした。フィルター条件を緩和してください。
        </div>
      ) : (
        <SectorInflowTable
          sectors={filteredSectors}
          onSelectSector={(sec) => setSelectedSector(sec)}
          categoryLevel={categoryLevel}
          viewMode={viewMode}
        />
      )}

      {/* 個別銘柄ドリルダウンドロワー */}
      <SectorDetailDrawer
        sector={selectedSector}
        onClose={() => setSelectedSector(null)}
      />
    </div>
  );
};

