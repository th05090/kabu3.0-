'use client';

import React, { useState } from 'react';
import { TrendTemplateTab } from './TrendTemplateTab';
import { VcpCandidatesTab } from './VcpCandidatesTab';
import { DiagnosticsTab } from './DiagnosticsTab';
import { TrendingUp, Target, Activity, HelpCircle } from 'lucide-react';
import Link from 'next/link';

export function SepaDashboard() {
  const [activeTab, setActiveTab] = useState<'trend' | 'vcp' | 'diagnostics'>('trend');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const handleSelectTicker = (ticker: string) => {
    setSelectedTicker(ticker);
    setActiveTab('diagnostics');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ページタイトル ＆ タブナビゲーション */}
      <div className="sepa-header">
        <div className="sepa-title-area">
          <h1>
            <TrendingUp size={24} style={{ color: '#10b981' }} />
            ミネルヴィニ SEPA (Specific Entry Point Analysis)
          </h1>
          <p>
            Stage 2 上昇トレンド・日本株独自動的RSレーティング・四半期単体成長・客観VCPスクリーニング
          </p>
        </div>

        <div>
          <Link href="/docs/sepa" className="sepa-guide-link">
            <HelpCircle size={15} />
            SEPA解説ガイド
          </Link>
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="sepa-tabs">
        <button
          onClick={() => setActiveTab('trend')}
          className={`sepa-tab-btn ${activeTab === 'trend' ? 'active-trend' : ''}`}
        >
          <TrendingUp size={16} />
          トレンドテンプレート (Stage 2)
        </button>
        <button
          onClick={() => setActiveTab('vcp')}
          className={`sepa-tab-btn ${activeTab === 'vcp' ? 'active-vcp' : ''}`}
        >
          <Target size={16} />
          VCP客観候補 & ピボット監視
        </button>
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`sepa-tab-btn ${activeTab === 'diagnostics' ? 'active-diag' : ''}`}
        >
          <Activity size={16} />
          個別銘柄 SEPA総合診断
        </button>
      </div>

      {/* タブコンテンツ */}
      <div>
        {activeTab === 'trend' && <TrendTemplateTab onSelectTicker={handleSelectTicker} />}
        {activeTab === 'vcp' && <VcpCandidatesTab onSelectTicker={handleSelectTicker} />}
        {activeTab === 'diagnostics' && <DiagnosticsTab initialTicker={selectedTicker} />}
      </div>
    </div>
  );
}
