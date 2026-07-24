import React from 'react';
import { createClient } from '@libsql/client';
import { notFound } from 'next/navigation';
import { StockAnalysisDashboard } from '@/features/analysis/components/StockAnalysisDashboard';
import fs from 'fs';
import path from 'path';

// SQLite client initialization
const db = createClient({
  url: 'file:local.db',
});

interface PageProps {
  params: Promise<{
    ticker: string;
  }>;
}

export default async function StockAnalysisPage({ params }: PageProps) {
  const { ticker } = await params;

  // 1. Fetch stock basic info
  const stockResult = await db.execute({
    sql: 'SELECT * FROM stocks WHERE ticker = ?',
    args: [ticker],
  });

  if (stockResult.rows.length === 0) {
    return notFound();
  }

  const stock = stockResult.rows[0];

  // 2. Fetch daily quotes for chart (ORDER BY date ASC is CRITICAL for lightweight-charts)
  const quotesResult = await db.execute({
    sql: 'SELECT date, close, adj_close, adj_open, adj_high, adj_low, adj_volume FROM daily_quotes WHERE ticker = ? ORDER BY date ASC',
    args: [ticker],
  });

  // 3. Fetch financials for chart (ORDER BY date ASC)
  const financialsResult = await db.execute({
    sql: 'SELECT date, net_sales, operating_profit, profit, equity_to_asset_ratio, shares_outstanding FROM financials WHERE ticker = ? ORDER BY date ASC',
    args: [ticker],
  });

  // Map SQLite rows to standard objects
  const mapRow = (row: any) => {
    const obj: any = {};
    for (const key of Object.keys(row)) {
      obj[key] = row[key];
    }
    return obj;
  };

  const stockData = mapRow(stock);
  const quotesData = quotesResult.rows.map(mapRow);
  const financialsData = financialsResult.rows.map(mapRow);

  // 4. Fetch AI Report if exists
  let aiReportData = null;
  try {
    // Check exact ticker (e.g., 72030_ai_report.json)
    let reportPath = path.join(process.cwd(), 'src', 'data', `${ticker}_ai_report.json`);
    
    // Fallback for J-Quants 5-digit ticker (e.g., 72030 -> 7203_ai_report.json)
    if (!fs.existsSync(reportPath) && ticker.length > 4) {
      const baseTicker = ticker.slice(0, 4);
      reportPath = path.join(process.cwd(), 'src', 'data', `${baseTicker}_ai_report.json`);
    }

    if (fs.existsSync(reportPath)) {
      const fileContent = fs.readFileSync(reportPath, 'utf8');
      aiReportData = JSON.parse(fileContent);
    }
  } catch (err) {
    console.error('Failed to read AI report:', err);
  }

  return (
    <div style={{ backgroundColor: 'var(--background)', flex: 1, height: '100%', overflowY: 'auto', padding: '1rem' }}>
      <StockAnalysisDashboard 
        stock={stockData} 
        quotes={quotesData} 
        financials={financialsData}
        aiReport={aiReportData}
      />
    </div>
  );
}

