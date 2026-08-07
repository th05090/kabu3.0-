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

  // Fetch equities_master (summary, theme, gics_sub_industry_id)
  const equitiesResult = await db.execute({
    sql: 'SELECT summary, theme, gics_sub_industry_id FROM equities_master WHERE ticker = ?',
    args: [ticker],
  });
  const equities = equitiesResult.rows.length > 0 ? equitiesResult.rows[0] : null;

  // Fetch shikiho_profiles (index_summary, index_keywords)
  const shikihoResult = await db.execute({
    sql: 'SELECT index_summary, index_keywords FROM shikiho_profiles WHERE ticker = ? OR ticker = ?',
    args: [ticker, ticker.substring(0, 4)],
  });
  const shikiho = shikihoResult.rows.length > 0 ? shikihoResult.rows[0] : null;

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
  const equitiesData = equities ? mapRow(equities) : null;
  const shikihoData = shikiho ? mapRow(shikiho) : null;

  // 4. Fetch AI Report from DB
  let aiReportData = null;
  try {
    const aiReportResult = await db.execute({
      sql: 'SELECT current_performance, future_guidance, report_comparison, ai_comment FROM ai_reports WHERE ticker = ?',
      args: [ticker]
    });
    
    // Fallback for J-Quants 5-digit ticker (e.g., 72030 -> 7203)
    let finalResult = aiReportResult;
    if (finalResult.rows.length === 0 && ticker.length > 4) {
      const baseTicker = ticker.slice(0, 4);
      finalResult = await db.execute({
        sql: 'SELECT current_performance, future_guidance, report_comparison, ai_comment FROM ai_reports WHERE ticker = ?',
        args: [baseTicker]
      });
    }

    if (finalResult.rows.length > 0) {
      const row = finalResult.rows[0];
      aiReportData = {
        current_performance: row.current_performance,
        future_guidance: row.future_guidance,
        report_comparison: row.report_comparison,
        ai_comment: row.ai_comment
      };
    }
  } catch (err) {
    console.error('Failed to read AI report from DB:', err);
  }

  return (
    <div style={{ backgroundColor: 'var(--background)', flex: 1, height: '100%', overflowY: 'auto', padding: '1rem' }}>
      <StockAnalysisDashboard 
        stock={stockData} 
        quotes={quotesData} 
        financials={financialsData}
        aiReport={aiReportData}
        equities={equitiesData}
        shikiho={shikihoData}
      />
    </div>
  );
}

