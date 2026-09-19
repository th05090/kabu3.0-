'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Lightbulb, TrendingUp, BookOpen } from 'lucide-react';
import { SyncButton } from './SyncButton';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">kabu3.0</div>
      <nav className="sidebar-nav">
        <Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>スクリーナー</span>
        </Link>
        <Link href="/themes" className={`nav-item ${pathname.startsWith('/themes') ? 'active' : ''}`}>
          <Lightbulb size={20} />
          <span>テーマ</span>
        </Link>
        <Link href="/sepa" className={`nav-item ${pathname.startsWith('/sepa') ? 'active' : ''}`}>
          <TrendingUp size={20} />
          <span>SEPA</span>
        </Link>
        <Link href="/docs" className={`nav-item ${pathname.startsWith('/docs') ? 'active' : ''}`}>
          <BookOpen size={20} />
          <span>ドキュメント</span>
        </Link>
      </nav>
      <div className="sidebar-footer">
        <SyncButton />
      </div>
    </aside>
  );
}
