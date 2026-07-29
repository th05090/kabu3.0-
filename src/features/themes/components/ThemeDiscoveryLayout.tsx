'use client';

import React, { useState } from 'react';
import { ThemeSearchTab } from './ThemeSearchTab';
import { CustomThemesTab } from './CustomThemesTab';
import { DataCleansingTab } from './DataCleansingTab';

export function ThemeDiscoveryLayout() {
  const [activeTab, setActiveTab] = useState<'search' | 'custom' | 'cleansing'>('search');

  return (
    <div className="theme-layout">
      <div className="theme-header">
        <h1>Theme Discovery</h1>
      </div>
      
      <div className="theme-tabs">
        <button
          className={`theme-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          テーマ検索
        </button>
        <button
          className={`theme-tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
          onClick={() => setActiveTab('custom')}
        >
          マイテーマ
        </button>
        <button
          className={`theme-tab-btn ${activeTab === 'cleansing' ? 'active' : ''}`}
          onClick={() => setActiveTab('cleansing')}
        >
          データクレンジング
        </button>
      </div>

      <div className="theme-content">
        {activeTab === 'search' && <ThemeSearchTab />}
        {activeTab === 'custom' && <CustomThemesTab />}
        {activeTab === 'cleansing' && <DataCleansingTab />}
      </div>
    </div>
  );
}
