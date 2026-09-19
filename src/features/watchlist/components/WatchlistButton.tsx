'use client';

import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Star } from 'lucide-react';
import { WatchlistSource } from '../types';

interface WatchlistButtonProps {
  ticker: string;
  source?: WatchlistSource;
  size?: number;
  className?: string;
  onToggle?: (isSaved: boolean) => void;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function WatchlistButton({
  ticker,
  source = 'manual',
  size = 16,
  className = '',
  onToggle,
}: WatchlistButtonProps) {
  const { data } = useSWR<{ tickers: string[] }>('/api/watchlist?mode=tickers', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  const isSavedInServer = data?.tickers?.includes(ticker) ?? false;
  // Optimistic UI state
  const [localSaved, setLocalSaved] = useState<boolean | null>(null);
  const isSaved = localSaved !== null ? localSaved : isSavedInServer;
  const [isLoading, setIsLoading] = useState(false);

  // サーバー側の値が更新されたらローカルの強制フラグをリセット
  React.useEffect(() => {
    setLocalSaved(null);
  }, [isSavedInServer]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isLoading) return;
    setIsLoading(true);

    const nextState = !isSaved;
    setLocalSaved(nextState);
    if (onToggle) onToggle(nextState);

    try {
      if (nextState) {
        // 追加
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, source }),
        });
      } else {
        // 削除
        await fetch(`/api/watchlist/${ticker}`, {
          method: 'DELETE',
        });
      }

      // SWRキャッシュを再検証
      mutate('/api/watchlist?mode=tickers');
      mutate('/api/watchlist');
    } catch (err) {
      console.error('Failed to toggle watchlist:', err);
      // ロールバック
      setLocalSaved(isSaved);
      if (onToggle) onToggle(isSaved);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={isSaved ? 'ウォッチリストから解除' : 'ウォッチリストに追加'}
      className={`watchlist-star-btn ${isSaved ? 'saved' : ''} ${className}`}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '2px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isSaved ? '#fbbf24' : '#64748b',
        transition: 'all 0.15s ease-in-out',
      }}
    >
      <Star
        size={size}
        fill={isSaved ? '#fbbf24' : 'none'}
        stroke={isSaved ? '#fbbf24' : 'currentColor'}
        strokeWidth={2}
      />
    </button>
  );
}
