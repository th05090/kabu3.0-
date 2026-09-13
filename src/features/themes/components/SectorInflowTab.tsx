'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Layers, RefreshCw, AlertCircle } from 'lucide-react';
import { CategoryLevel, InflowPeriod, SectorInflowApiResponse, SectorInflowSummary } from '../sector_inflow_types';
import { SectorInflowTable } from './SectorInflowTable';
import { SectorDetailDrawer } from './SectorDetailDrawer';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const SectorInflowTab: React.FC = () => {
  const [period, setPeriod] = useState<InflowPeriod>(20);
  const [categoryLevel, setCategoryLevel] = useState<CategoryLevel>('industry');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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

  // フィルタリング処理 (全業種で静的スコア計算後にUIで間引く)
  const filteredSectors = useMemo(() => {
    return sectors.filter((sec) => {
      if (sec.stockCount < minStocks) return false;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'SUPER' && sec.status.variant !== 'super') return false;
        if (statusFilter === 'EARLY' && sec.status.variant !== 'early') return false;
        if (statusFilter === 'DEFENSIVE' && sec.status.variant !== 'defensive') return false;
        if (statusFilter === 'LAGGING' && sec.status.variant !== 'lagging') return false;
        if (statusFilter === 'OUTFLOW' && sec.status.variant !== 'outflow') return false;
      }
      return true;
    });
  }, [sectors, minStocks, statusFilter]);

  // トップ3業種
  const topSectors = useMemo(() => sectors.slice(0, 3), [sectors]);

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
              売買代金シェア変化率、規格化MFV、グループA/D比、ブレッドスなど3層11指標から、市場の資金シフトとセクター内の大口買い集め傾向を客観的に炙り出します。
            </p>
          </div>

          {/* 分類レベル切り替え & 期間切り替え */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div className="sector-inflow-window-tabs">
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0 0.5rem' }}>分類:</span>
              <button
                onClick={() => setCategoryLevel('industry')}
                className={`sector-inflow-window-btn ${categoryLevel === 'industry' ? 'active' : ''}`}
              >
                業種 (6桁 / ~74)
              </button>
              <button
                onClick={() => setCategoryLevel('industry_group')}
                className={`sector-inflow-window-btn ${categoryLevel === 'industry_group' ? 'active' : ''}`}
              >
                業種グループ (4桁 / ~25)
              </button>
            </div>

            <div className="sector-inflow-window-tabs">
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0 0.5rem' }}>期間:</span>
              {[
                { id: 5 as InflowPeriod, label: '5日 (初動)' },
                { id: 20 as InflowPeriod, label: '20日 (標準)' },
                { id: 60 as InflowPeriod, label: '60日 (定着)' },
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
                  <span className="sector-top-rank">#{idx + 1} 流入トップ</span>
                  <span className="sector-top-score">{sec.finalScore}点</span>
                </div>
                <div className="sector-top-name">{sec.industryName}</div>
                <div className="sector-top-metrics">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* フィルターバー */}
      <div className="sector-inflow-filter-bar">
        <div className="sector-filter-buttons">
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '0.25rem' }}>状態絞込:</span>
          {[
            { id: 'ALL', label: 'すべて' },
            { id: 'SUPER', label: '🔥 強烈な資金流入' },
            { id: 'EARLY', label: '📈 資金流入の初期兆候' },
            { id: 'LAGGING', label: '📈 上昇（市場劣後）' },
            { id: 'DEFENSIVE', label: '⚖ 相対優位（地合い不良）' },
            { id: 'OUTFLOW', label: '📉 資金流出傾向' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className={`sector-filter-btn ${statusFilter === item.id ? 'active' : ''}`}
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

