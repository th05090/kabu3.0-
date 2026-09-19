'use client';

import React from 'react';
import { MarketRegimeIndicator } from '@/features/market_regime/components/MarketRegimeIndicator';

export function AppHeader() {
  return (
    <header className="app-top-header">
      <div className="header-left">
        {/* 左側は画面に応じた自然な余白、またはブレッドクラム */}
      </div>
      <div className="header-right">
        <MarketRegimeIndicator />
      </div>
    </header>
  );
}
