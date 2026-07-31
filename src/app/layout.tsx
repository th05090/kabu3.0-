import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LayoutDashboard, BarChart2, Lightbulb, Bell, Briefcase } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
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
          <Sidebar />
          <div className="app-main">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
