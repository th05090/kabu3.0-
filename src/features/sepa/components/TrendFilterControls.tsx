import React from 'react';
import { Search, Filter, Sparkles, TrendingUp, Flame, Building2 } from 'lucide-react';

interface TrendFilterControlsProps {
  filter: string;
  setFilter: (f: string) => void;
  excludeEtf: boolean;
  setExcludeEtf: (b: boolean) => void;
  minRs: number | null;
  setMinRs: (rs: number | null) => void;
  accelerating: boolean;
  setAccelerating: (b: boolean) => void;
  marginExpansion: boolean;
  setMarginExpansion: (b: boolean) => void;
  sweetSpotCap: boolean;
  setSweetSpotCap: (b: boolean) => void;
  midLargeCap: boolean;
  setMidLargeCap: (b: boolean) => void;
  minLiquidity: boolean;
  setMinLiquidity: (b: boolean) => void;
  roe15: boolean;
  setRoe15: (b: boolean) => void;
  annualGrowth: boolean;
  setAnnualGrowth: (b: boolean) => void;
  search: string;
  setSearch: (s: string) => void;
  onReset: () => void;
}

export function TrendFilterControls({
  filter,
  setFilter,
  excludeEtf,
  setExcludeEtf,
  minRs,
  setMinRs,
  accelerating,
  setAccelerating,
  marginExpansion,
  setMarginExpansion,
  sweetSpotCap,
  setSweetSpotCap,
  midLargeCap,
  setMidLargeCap,
  minLiquidity,
  setMinLiquidity,
  roe15,
  setRoe15,
  annualGrowth,
  setAnnualGrowth,
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
            onClick={() => setFilter('tier1')}
            className={`sepa-chip ${filter === 'tier1' ? 'active-emerald' : ''}`}
            title="Stage 2（8条件）かつ 直近四半期EPS+20%以上（または黒字転換）かつ 直近四半期売上+10%以上のコア成長株"
          >
            <Sparkles size={13} />
            ★ Stage 2 + コア成長 (Tier 1)
          </button>
          <button
            onClick={() => setFilter('all_pass')}
            className={`sepa-chip ${filter === 'all_pass' ? 'active-green' : ''}`}
          >
            <TrendingUp size={13} />
            Stage 2 全件 (8/8)
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

      {/* サブ条件 (ミネルヴィニ Tier 2 発展オプショントグル) */}
      <div className="sepa-filter-row-sub">
        <span className="sepa-filter-label">
          <Filter size={12} /> Tier 2 発展トグル:
        </span>

        {/* 株式のみ (投信除外) */}
        <button
          onClick={() => setExcludeEtf(!excludeEtf)}
          className={`sepa-chip ${excludeEtf ? 'active-purple' : ''}`}
          title="ETF、ETN、REIT、投資法人、投信等を除外して事業会社（株式）のみを表示"
        >
          <Building2 size={13} />
          株式のみ (投信除外)
        </button>

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
          title="当期売上またはEPSが前期より加速、かつ足切り水準クリア"
        >
          成長加速 (売上/EPS)
        </button>

        {/* 利益率改善 */}
        <button
          onClick={() => setMarginExpansion(!marginExpansion)}
          className={`sepa-chip ${marginExpansion ? 'active-cyan' : ''}`}
          title="単体営業利益率が前年同期より改善"
        >
          単体営利率改善
        </button>

        {/* 3年連続増益 */}
        <button
          onClick={() => setAnnualGrowth(!annualGrowth)}
          className={`sepa-chip ${annualGrowth ? 'active-purple' : ''}`}
          title="過去3年間、年間EPSが連続成長（株式分割調整後adj_eps、IPOバイパス対応）"
        >
          3年連続増益
        </button>

        {/* ROE 15%↑ */}
        <button
          onClick={() => setRoe15(!roe15)}
          className={`sepa-chip ${roe15 ? 'active-amber' : ''}`}
          title="ROE 15%以上（債務超過企業は除外）"
        >
          ROE 15%↑
        </button>

        {/* 時価総額 100〜1000億 */}
        <button
          onClick={() => {
            const next = !sweetSpotCap;
            setSweetSpotCap(next);
            if (next) setMidLargeCap(false);
          }}
          className={`sepa-chip ${sweetSpotCap ? 'active-amber' : ''}`}
        >
          時価総額 100〜1,000億
        </button>

        {/* 時価総額 300〜3000億 */}
        <button
          onClick={() => {
            const next = !midLargeCap;
            setMidLargeCap(next);
            if (next) setSweetSpotCap(false);
          }}
          className={`sepa-chip ${midLargeCap ? 'active-indigo' : ''}`}
        >
          時価総額 300〜3,000億
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
