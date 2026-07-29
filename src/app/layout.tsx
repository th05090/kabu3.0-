import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LayoutDashboard, BarChart2, Lightbulb, Bell, Briefcase } from 'lucide-react';
import { SyncButton } from '@/components/SyncButton';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "kabu3.0",
  description: "Stock screening and analysis platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <div className="app-layout">
          <aside className="app-sidebar">
            <div className="sidebar-logo">kabu3.0</div>
            <nav className="sidebar-nav">
              <a href="/" className="nav-item"><LayoutDashboard size={20} /><span>スクリーナー</span></a>
              <a href="#" className="nav-item"><BarChart2 size={20} /><span>個別分析</span></a>
              <a href="/themes" className="nav-item active"><Lightbulb size={20} /><span>テーマ</span></a>
              <a href="#" className="nav-item"><Bell size={20} /><span>アラート</span></a>
              <a href="#" className="nav-item"><Briefcase size={20} /><span>ポートフォリオ</span></a>
            </nav>
            <div className="sidebar-footer">
              <SyncButton />
            </div>
          </aside>
          <div className="app-main">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
