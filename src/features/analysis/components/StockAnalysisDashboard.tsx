import React from 'react';
import Link from 'next/link';
import { PriceChart } from './PriceChart';
import { AIAnalystReport } from './AIAnalystReport';

interface Props {
  stock: any;
  quotes: any[];
  financials: any[];
  aiReport?: any;
}

export function StockAnalysisDashboard({ stock, quotes, financials, aiReport }: Props) {
  const fmt = (v: any, p='', s='') => v == null ? '-' : `${p}${Number(v).toLocaleString()}${s}`;
  
  // Use passed aiReport if available
  const aiData = aiReport || null;

  return (
    <div className="dashboard-container">
      {/* Header Navigation */}
      <div className="dashboard-header">
        <Link href="/">
          <span style={{ fontSize: '1.2rem' }}>←</span> スクリーナーに戻る
        </Link>
      </div>

      <div className="dashboard-grid">
        
        {/* 1. 基本情報 & 2. 株価情報 */}
        <div className="bento-card">
          <div className="stock-basic-info">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <h1 style={{ flex: 1 }}>{stock.name}</h1>
                <span className="ticker" style={{ flexShrink: 0 }}>{stock.ticker.slice(0,4)}</span>
              </div>
              <div className="stock-basic-tags">
                <span className="stock-tag market">{stock.market}</span>
                <span className="stock-tag industry">{stock.industry}</span>
              </div>
            </div>
            
            <div className="stock-price-display">
              <div className="price">
                ¥{Number(stock.current_price).toLocaleString()}
              </div>
              <div className="market-cap">
                時価総額: {fmt(stock.market_cap, '', ' 億円')}
              </div>
            </div>
          </div>
        </div>

        {/* 3. 株価チャート (Wide Card) */}
        <div className="bento-card card-chart" style={{ minHeight: '450px' }}>
          <h2>株価チャート (日足)</h2>
          <div style={{ flex: 1, marginTop: '-0.5rem' }}>
            <PriceChart data={quotes} />
          </div>
        </div>

        {/* 4. モメンタム指標 */}
        <div className="bento-card">
          <h2>モメンタム指標</h2>
          <div className="metric-row"><span className="metric-label">5日騰落率</span><span className="metric-value">{fmt(stock.return_5d_pct, '', '%')}</span></div>
          <div className="metric-row"><span className="metric-label">20日騰落率</span><span className="metric-value">{fmt(stock.return_20d_pct, '', '%')}</span></div>
          <div className="metric-row"><span className="metric-label">出来高倍率</span><span className="metric-value">{fmt(stock.volume_ratio, '', '倍')}</span></div>
          <div className="metric-row"><span className="metric-label">52週高値</span><span className="metric-value">{fmt(stock.high_52w, '¥')}</span></div>
          <div className="metric-row"><span className="metric-label">52週高値距離</span><span className="metric-value">{fmt(stock.distance_to_high_52w_pct, '', '%')}</span></div>
        </div>

        {/* 5. テクニカル指標 */}
        <div className="bento-card">
          <h2>テクニカル指標</h2>
          <div className="metric-row"><span className="metric-label">25日線乖離率</span><span className="metric-value">{fmt(stock.sma_25_deviation_pct, '', '%')}</span></div>
          <div className="metric-row"><span className="metric-label">パーフェクトオーダー</span><span className="metric-value">{stock.is_perfect_order ? '成立' : '-'}</span></div>
          <div className="metric-row"><span className="metric-label">RSI(14)</span><span className="metric-value">{fmt(stock.rsi)}</span></div>
          <div className="metric-row"><span className="metric-label">MACD</span><span className="metric-value">{fmt(stock.macd)}</span></div>
          <div className="metric-row"><span className="metric-label">ATR(14)</span><span className="metric-value">{fmt(stock.atr_14)}</span></div>
        </div>

        {/* 6. 決算情報 */}
        <div className="bento-card">
          <h2>決算情報</h2>
          <div className="metric-row"><span className="metric-label">決算日</span><span className="metric-value">{stock.earnings_date || '-'}</span></div>
          <div className="metric-row"><span className="metric-label">決算後日数</span><span className="metric-value">{fmt(stock.days_since_earnings, '', '日')}</span></div>
          <div className="metric-row"><span className="metric-label">決算反応</span><span className="metric-value">{fmt(stock.earnings_reaction_pct, '', '%')}</span></div>
          <div className="metric-row"><span className="metric-label">決算後高値から下落</span><span className="metric-value">{fmt(stock.drop_from_post_earnings_high_pct, '', '%')}</span></div>
          <div className="metric-row"><span className="metric-label">次回決算予定</span><span className="metric-value">{stock.next_earnings_date_prediction || '-'}</span></div>
        </div>

        {/* 7. 業績 & 8. 財務 */}
        <div className="bento-card">
          <h2>業績・財務情報</h2>
          <div className="metric-row"><span className="metric-label">売上成長率</span><span className="metric-value">{fmt(stock.revenue_growth_pct, '', '%')}</span></div>
          <div className="metric-row"><span className="metric-label">営利成長率</span><span className="metric-value">{fmt(stock.operating_profit_growth_pct, '', '%')}</span></div>
          <div className="metric-row"><span className="metric-label">営業利益率</span><span className="metric-value">{fmt(stock.operating_margin_pct, '', '%')}</span></div>
          <div className="metric-row"><span className="metric-label">自己資本比率</span><span className="metric-value">{fmt(stock.equity_ratio_pct, '', '%')}</span></div>
          <div className="metric-row"><span className="metric-label">営業CF</span><span className="metric-value">{fmt(stock.operating_cf)}</span></div>
        </div>

        {/* 9. 株価指標 (Valuation) */}
        <div className="bento-card">
          <h2>バリュエーション (株価指標)</h2>
          <div className="metric-row"><span className="metric-label">PER</span><span className="metric-value">{fmt(stock.per, '', '倍')}</span></div>
          <div className="metric-row"><span className="metric-label">PBR</span><span className="metric-value">{fmt(stock.pbr, '', '倍')}</span></div>
          <div className="metric-row"><span className="metric-label">ROE</span><span className="metric-value">{fmt(stock.roe, '', '%')}</span></div>
          <div className="metric-row"><span className="metric-label">配当利回り</span><span className="metric-value">{fmt(stock.dividend_yield_pct, '', '%')}</span></div>
        </div>

        {/* 11. リスク管理情報 */}
        <div className="bento-card">
          <h2>リスク管理情報</h2>
          <div className="metric-row"><span className="metric-label">2ATR 損切ライン</span><span className="metric-value">{fmt(stock.stop_loss_2atr, '¥')}</span></div>
          <div className="metric-row"><span className="metric-label">最大ドローダウン</span><span className="metric-value">{fmt(stock.max_drawdown, '', '%')}</span></div>
          <div className="metric-row"><span className="metric-label">ボラティリティ</span><span className="metric-value mock">-</span></div>
        </div>

        {/* 10. AI 企業分析サマリー */}
        {aiData && (
          <AIAnalystReport data={aiData} />
        )}

      </div>
    </div>
  );
}
