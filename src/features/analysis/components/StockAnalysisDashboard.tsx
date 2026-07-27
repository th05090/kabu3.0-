"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { PriceChart } from './PriceChart';
import { AIAnalystReport } from './AIAnalystReport';
import { GICS_DICTIONARY } from '@/data/gics_dictionary';

interface Props {
  stock: any;
  quotes: any[];
  financials: any[];
  aiReport?: any;
  equities?: any;
  shikiho?: any;
}

export function StockAnalysisDashboard({ stock, quotes, financials, aiReport, equities, shikiho }: Props) {
  const fmt = (v: any, p='', s='') => v == null ? '-' : `${p}${Number(v).toLocaleString()}${s}`;
  
  // Use passed aiReport if available
  const aiData = aiReport || null;

  // Local state for optimistic updates
  const [summary, setSummary] = useState(equities?.summary || '');
  const [gicsInfo, setGicsInfo] = useState(equities?.gics_sub_industry_id ? GICS_DICTIONARY[equities.gics_sub_industry_id] : null);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleEditClick = () => {
    setEditText(summary);
    setIsEditing(true);
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/stocks/${stock.ticker}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: editText })
      });
      const data = await res.json();
      if (res.ok) {
        setSummary(editText);
        if (data.newGicsId && GICS_DICTIONARY[data.newGicsId]) {
          setGicsInfo(GICS_DICTIONARY[data.newGicsId]);
        }
        setIsEditing(false);
      } else {
        alert("保存に失敗しました: " + data.error);
      }
    } catch (e) {
      alert("通信エラーが発生しました");
    } finally {
      setIsSaving(false);
    }
  };

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
              
              <div style={{ marginTop: '1rem', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--foreground)' }}>事業要約</h3>
                  {!isEditing && (
                    <button 
                      onClick={handleEditClick}
                      style={{ background: 'none', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--foreground)' }}
                    >
                      ✎ 編集
                    </button>
                  )}
                </div>
                
                {isEditing ? (
                  <div>
                    <textarea 
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      disabled={isSaving}
                      style={{ 
                        width: '100%', 
                        minHeight: '80px', 
                        padding: '8px', 
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--background)',
                        color: 'var(--foreground)',
                        fontSize: '0.9rem',
                        lineHeight: '1.5',
                        resize: 'vertical'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => setIsEditing(false)}
                        disabled={isSaving}
                        style={{ padding: '4px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--foreground)' }}
                      >
                        キャンセル
                      </button>
                      <button 
                        onClick={handleSaveClick}
                        disabled={isSaving}
                        style={{ padding: '4px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        {isSaving ? '保存中...' : '保存'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.9rem', color: '#888', lineHeight: '1.5' }}>
                    {summary || '要約情報がありません'}
                  </div>
                )}
              </div>
            </div>
            
            <div className="stock-price-display" style={{ marginTop: '1rem' }}>
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

        {/* 分類情報 */}
        <div className="bento-card">
          <h2>分類情報</h2>
          <div className="metric-row">
            <span className="metric-label">大分類 (主幹テーマ)</span>
            <span className="metric-value" style={{ color: 'var(--primary)' }}>{gicsInfo?.sector_name || equities?.theme || '未分類'}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">中分類</span>
            <span className="metric-value">{gicsInfo?.industry_group_name || '-'}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">小分類</span>
            <span className="metric-value">{gicsInfo?.industry_name || '-'}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">細分類</span>
            <span className="metric-value" style={{ fontSize: '0.9rem', textAlign: 'right' }}>{gicsInfo?.sub_industry_name || '-'}</span>
          </div>
        </div>

        {/* テーマ情報 */}
        <div className="bento-card">
          <h2>テーマ情報</h2>
          <div>
            <span className="metric-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#888' }}>機能的価値 (四季報キーワード)</span>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
              {shikiho?.index_keywords ? shikiho.index_keywords.split(',').map((kw: string, i: number) => (
                <span key={i} style={{ 
                  display: 'inline-block', 
                  padding: '4px 8px', 
                  margin: '0 6px 6px 0', 
                  backgroundColor: 'var(--hover-bg)', 
                  borderRadius: '4px', 
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)'
                }}>
                  {kw.trim()}
                </span>
              )) : '-'}
            </div>
            
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)' }}>
              <span className="metric-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#888' }}>四季報 事業概要</span>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: '1.5' }}>
                {shikiho?.index_summary || 'データなし'}
              </div>
            </div>
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
