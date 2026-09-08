import React from 'react';
import { Search, Filter, Sparkles, TrendingUp, Flame } from 'lucide-react';

interface TrendFilterControlsProps {
  filter: string;
  setFilter: (f: string) => void;
  minRs: number | null;
  setMinRs: (rs: number | null) => void;
  accelerating: boolean;
  setAccelerating: (b: boolean) => void;
  marginExpansion: boolean;
  setMarginExpansion: (b: boolean) => void;
  sweetSpotCap: boolean;
  setSweetSpotCap: (b: boolean) => void;
  minLiquidity: boolean;
  setMinLiquidity: (b: boolean) => void;
  search: string;
  setSearch: (s: string) => void;
  onReset: () => void;
}

export function TrendFilterControls({
  filter,
  setFilter,
  minRs,
  setMinRs,
  accelerating,
  setAccelerating,
  marginExpansion,
  setMarginExpansion,
  sweetSpotCap,
  setSweetSpotCap,
  minLiquidity,
  setMinLiquidity,
  search,
  setSearch,
  onReset
}: TrendFilterControlsProps) {
  return (
    <div className="sepa-filter-box">
      {/* 検索 ＆ メインプリセット */}
      <div className="sepa-filter-row-top">
        <div className="sepa-search-wrapper">
          <Search size={15} className="sepa-search-icon" />
          <input
            type="text"
            placeholder="銘柄コード・企業名で検索..."
            className="sepa-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="sepa-btn-group">
          <button
            onClick={() => setFilter('all_pass')}
            className={`sepa-chip ${filter === 'all_pass' ? 'active-green' : ''}`}
          >
            <TrendingUp size={13} />
            Stage 2 合格 (8/8)
          </button>
          <button
            onClick={() => setFilter('ipo_only')}
            className={`sepa-chip ${filter === 'ipo_only' ? 'active-amber' : ''}`}
          >
            <Sparkles size={13} />
            IPO急成長株
          </button>
          <button
            onClick={() => setFilter('turnaround')}
            className={`sepa-chip ${filter === 'turnaround' ? 'active-indigo' : ''}`}
          >
            <Flame size={13} />
            黒字転換
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`sepa-chip ${filter === 'all' ? 'active-neutral' : ''}`}
          >
            全件
          </button>
        </div>
      </div>

      {/* サブ条件 (ミネルヴィニ・ファンダメンタルズ条件) */}
      <div className="sepa-filter-row-sub">
        <span className="sepa-filter-label">
          <Filter size={12} /> ファンダ絞り込み:
        </span>

        {/* RSフィルター */}
        <button
          onClick={() => setMinRs(minRs === 80 ? null : 80)}
          className={`sepa-chip ${minRs === 80 ? 'active-indigo' : ''}`}
        >
          RS &gt;= 80
        </button>

        {/* 成長加速 */}
        <button
          onClick={() => setAccelerating(!accelerating)}
          className={`sepa-chip ${accelerating ? 'active-green' : ''}`}
        >
          成長加速 (売上/EPS)
        </button>

        {/* 利益率改善 */}
        <button
          onClick={() => setMarginExpansion(!marginExpansion)}
          className={`sepa-chip ${marginExpansion ? 'active-cyan' : ''}`}
        >
          単体営利率改善
        </button>

        {/* 時価総額 100〜1000億 */}
        <button
          onClick={() => setSweetSpotCap(!sweetSpotCap)}
          className={`sepa-chip ${sweetSpotCap ? 'active-amber' : ''}`}
        >
          時価総額 100〜1,000億
        </button>

        {/* 売買代金 1億以上 */}
        <button
          onClick={() => setMinLiquidity(!minLiquidity)}
          className={`sepa-chip ${minLiquidity ? 'active-blue' : ''}`}
        >
          売買代金 &gt;= 1億
        </button>

        <button
          onClick={onReset}
          className="sepa-reset-btn"
        >
          リセット
        </button>
      </div>
    </div>
  );
}
