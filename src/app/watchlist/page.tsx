import React from 'react';
import { WatchlistDashboard } from '@/features/watchlist/components/WatchlistDashboard';

export const metadata = {
  title: 'ウォッチリスト | kabu3.0',
  description: '気になる銘柄・監視銘柄の一括トラッキングと日足チャートプレビュー',
};

export default function WatchlistPage() {
  return (
    <main className="p-4" style={{ height: 'calc(100vh - 54px)', display: 'flex', flexDirection: 'column' }}>
      <WatchlistDashboard />
    </main>
  );
}
