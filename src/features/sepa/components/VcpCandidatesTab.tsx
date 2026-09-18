'use client';

import React, { useState } from 'react';
import { useSepaVcp, useSepaDiagnostics } from '../hooks/useSepa';
import { VcpCandidatesTable } from './VcpCandidatesTable';
import { VcpChartPreview } from './VcpChartPreview';
import { Activity, CheckCircle2, Building2, Sparkles, Rocket, ChevronLeft, ChevronRight } from 'lucide-react';

interface VcpCandidatesTabProps {
  onSelectTicker: (ticker: string) => void;
}

export function VcpCandidatesTab({ onSelectTicker }: VcpCandidatesTabProps) {
  const [mode, setMode] = useState<string>('strict_funda');
  const [excludeEtf, setExcludeEtf] = useState<boolean>(true);
  const [sweetSpotCap, setSweetSpotCap] = useState<boolean>(false);
  const [midLargeCap, setMidLargeCap] = useState<boolean>(false);
  const [minLiquidity, setMinLiquidity] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const { candidates, total, totalPages, isLoading } = useSepaVcp(
    mode,
    page,
    50,
    sortBy,
    order,
    excludeEtf,
    sweetSpotCap,
    minLiquidity,
    midLargeCap
  );
  const { diagnostics, isLoading: diagLoading } = useSepaDiagnostics(selectedTicker);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      if (order === 'desc') {
        setOrder('asc');
      } else {
        setSortBy(null);
        setOrder('desc');
      }
    } else {
      setSortBy(field);
      setOrder('desc');
    }
    setPage(1);
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    setPage(1);
    setSortBy(null);
    setOrder('desc');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* モード切替バー */}
      <div className="sepa-filter-box" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="sepa-btn-group">
          {/* 1. Stage2 + コア成長 (Tier 1) */}
          <button
            onClick={() => handleModeChange('strict_funda')}
            className={`sepa-chip ${mode === 'strict_funda' ? 'active-emerald' : ''}`}
            title="Stage 2（RS>=80）かつ 直近四半期EPS+20%以上（または黒字転換）かつ 直近四半期売上+10%以上のコア成長株"
          >
            <CheckCircle2 size={14} />
            Stage2 + コア成長 (Tier 1)
          </button>

          {/* 2. ★ Stage2 + 21EMA押し目 (紫/メイン) */}
          <button
            onClick={() => handleModeChange('stage2_pullback_21_ema')}
            className={`sepa-chip ${mode === 'stage2_pullback_21_ema' ? 'active-purple' : ''}`}
            title="構造的Stage 2（RS>=75）かつ 21日EMAサポート押し目（直近高値から調整 -3%〜-12%、乖離 -1.5%〜+3.5%、出来高枯渇）"
          >
            <Sparkles size={14} />
            ★ Stage2 + 21EMA押し目
          </button>

          {/* 3. Stage2 + 50日押し目 (シアン/サブ) */}
          <button
            onClick={() => handleModeChange('stage2_pullback_50')}
            className={`sepa-chip ${mode === 'stage2_pullback_50' ? 'active-cyan' : ''}`}
            title="構造的Stage 2（RS>=75）かつ 50日SMAサポート押し目（直近高値から調整 -5%〜-20%、乖離 -2.0%〜+3.5%、出来高枯渇）"
          >
            <Sparkles size={14} />
            Stage2 + 50日押し目
          </button>

          {/* 4. 🚀 ブレイク後押し目 (アンバー/新設) */}
          <button
            onClick={() => handleModeChange('breakout_pullback')}
            className={`sepa-chip ${mode === 'breakout_pullback' ? 'active-amber' : ''}`}
            title="過去3〜25営業日前に出来高急増でブレイクアウトし、現在25日線または50日線で健全な押し目を形成している銘柄 (RS>=75)"
          >
            <Rocket size={14} />
            🚀 ブレイク後押し目
          </button>

          {/* 5. 全VCP候補 (アンバー) */}
          <button
            onClick={() => handleModeChange('all')}
            className={`sepa-chip ${mode === 'all' ? 'active-amber' : ''}`}
            title="Stage 2合格かつ ピボット接近・出来高枯渇・ATR収縮のいずれかを満たす全候補"
          >
            <Activity size={14} />
            全VCP候補
          </button>

          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 0.25rem' }} />

          <button
            onClick={() => { setExcludeEtf(!excludeEtf); setPage(1); }}
            className={`sepa-chip ${excludeEtf ? 'active-purple' : ''}`}
            title="ETF、ETN、REIT、投資法人、投信等を除外して事業会社（株式）のみを表示"
          >
            <Building2 size={13} />
            株式のみ (投信除外)
          </button>

          <button
            onClick={() => {
              const next = !sweetSpotCap;
              setSweetSpotCap(next);
              if (next) setMidLargeCap(false);
              setPage(1);
            }}
            className={`sepa-chip ${sweetSpotCap ? 'active-amber' : ''}`}
            title="時価総額100〜1,000億円の中小型スイートスポット銘柄に限定"
          >
            時価総額 100〜1,000億
          </button>

          <button
            onClick={() => {
              const next = !midLargeCap;
              setMidLargeCap(next);
              if (next) setSweetSpotCap(false);
              setPage(1);
            }}
            className={`sepa-chip ${midLargeCap ? 'active-indigo' : ''}`}
            title="時価総額300〜3,000億円の中大型銘柄に限定"
          >
            時価総額 300〜3,000億
          </button>

          <button
            onClick={() => { setMinLiquidity(!minLiquidity); setPage(1); }}
            className={`sepa-chip ${minLiquidity ? 'active-blue' : ''}`}
            title="5日平均売買代金1億円以上"
          >
            売買代金 &gt;= 1億
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            該当: <span style={{ color: '#fff', fontWeight: 'bold' }}>{total.toLocaleString()}</span> 件
            <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>(クリックでチャート即時展開)</span>
          </div>
          {totalPages > 1 && (
            <div className="sepa-pagination" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              <span>{page} / {totalPages} ページ</span>
              <button
                disabled={page <= 1 || isLoading}
                onClick={() => setPage(p => p - 1)}
                className="sepa-page-btn"
                title="前のページ"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage(p => p + 1)}
                className="sepa-page-btn"
                title="次のページ"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2ペイン分割: 左テーブル ＆ 右目視チャート */}
      <div className="sepa-split-layout">
        {/* 左: 銘柄一覧テーブル */}
        <VcpCandidatesTable
          candidates={candidates}
          total={total}
          totalPages={totalPages}
          page={page}
          isLoading={isLoading}
          mode={mode}
          selectedTicker={selectedTicker}
          sortBy={sortBy}
          order={order}
          onSort={handleSort}
          onSelectTicker={setSelectedTicker}
          onPageChange={setPage}
        />

        {/* 右: 目視チャートプレビュー */}
        <VcpChartPreview
          selectedTicker={selectedTicker}
          mode={mode}
          diagnostics={diagnostics}
          isLoading={diagLoading}
          onOpenDetails={onSelectTicker}
        />
      </div>
    </div>
  );
}
