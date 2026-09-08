'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BarChart2, Lightbulb, Bell, Briefcase, TrendingUp } from 'lucide-react';
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
        <Link href="#" className={`nav-item ${pathname.startsWith('/stocks') ? 'active' : ''}`}>
          <BarChart2 size={20} />
          <span>個別分析</span>
        </Link>
        <Link href="/themes" className={`nav-item ${pathname.startsWith('/themes') ? 'active' : ''}`}>
          <Lightbulb size={20} />
          <span>テーマ</span>
        </Link>
        <Link href="/sepa" className={`nav-item ${pathname.startsWith('/sepa') ? 'active' : ''}`}>
          <TrendingUp size={20} />
          <span>SEPA</span>
        </Link>
        <Link href="#" className={`nav-item ${pathname.startsWith('/alerts') ? 'active' : ''}`}>
          <Bell size={20} />
          <span>アラート</span>
        </Link>
        <Link href="#" className={`nav-item ${pathname.startsWith('/portfolio') ? 'active' : ''}`}>
          <Briefcase size={20} />
          <span>ポートフォリオ</span>
        </Link>
      </nav>
      <div className="sidebar-footer">
        <SyncButton />
      </div>
    </aside>
  );
}
