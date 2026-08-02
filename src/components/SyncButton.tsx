'use client';

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  const handleSync = async () => {
    setIsSyncing(true);
    setProgressMsg('同期を開始しています...');
    try {
      const res = await fetch('/api/data-sync', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Sync failed');
      }
      if (!res.body) throw new Error('No body returned');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process line by line
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'progress') {
                setProgressMsg(parsed.message);
              } else if (parsed.type === 'error') {
                alert(`データ同期中にエラーが発生しました: ${parsed.message}`);
                break;
              } else if (parsed.type === 'done') {
                alert('データの同期と再計算が完了しました');
              }
            } catch (err) {
              console.error('Failed to parse SSE JSON', dataStr);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      alert('データ同期中に通信エラーが発生しました');
    } finally {
      setIsSyncing(false);
      setProgressMsg('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <button 
        onClick={handleSync}
        disabled={isSyncing}
        className={`nav-item sync-btn ${isSyncing ? 'syncing' : ''}`}
        style={{ width: '100%', justifyContent: 'flex-start' }}
      >
        <RefreshCw size={20} className={isSyncing ? 'spin' : ''} />
        <span>{isSyncing ? '更新中...' : 'データ同期'}</span>
      </button>
      {isSyncing && progressMsg && (
        <div style={{ 
          fontSize: '0.7rem', 
          color: '#888', 
          padding: '0 0.5rem', 
          lineHeight: '1.2',
          wordBreak: 'break-all'
        }}>
          {progressMsg}
        </div>
      )}
    </div>
  );
}
