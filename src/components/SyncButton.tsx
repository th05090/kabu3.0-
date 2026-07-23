'use client';

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/data-sync', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Sync failed');
      }
      alert('データの同期と再計算が完了しました');
    } catch (error) {
      console.error(error);
      alert('データ同期中にエラーが発生しました');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <button 
      onClick={handleSync}
      disabled={isSyncing}
      className={`nav-item sync-btn ${isSyncing ? 'syncing' : ''}`}
    >
      <RefreshCw size={20} className={isSyncing ? 'spin' : ''} />
      <span>{isSyncing ? '更新中...' : 'データ同期'}</span>
    </button>
  );
}
