'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { GICS_DICTIONARY } from '@/data/gics_dictionary';

// Group GICS by Sector
const groupedGics = Object.entries(GICS_DICTIONARY).reduce((acc, [id, gics]) => {
  if (!acc[gics.sector_name]) {
    acc[gics.sector_name] = [];
  }
  acc[gics.sector_name].push({ id, name: gics.sub_industry_name });
  return acc;
}, {} as Record<string, { id: string; name: string }[]>);

export function StockFilter() {
  const searchParams = useSearchParams();
  const getVal = (key: string) => searchParams.get(key) || '';
  const isChecked = (key: string) => searchParams.get(key) === '1';

  return (
    <form method="GET" action="/" className="filter-container">
      <h3>スクリーナー フィルタ</h3>
      
      <div className="filter-grid">
        {/* 基本フィルタ */}
        <div className="filter-section">
          <h4>基本</h4>
          <label>コード: <input type="text" name="ticker" defaultValue={getVal('ticker')} style={{width:'80px'}} /></label>
          <label>銘柄名: <input type="text" name="name" defaultValue={getVal('name')} style={{width:'150px'}} /></label>
          <label>業種(東証33): <input type="text" name="industry" defaultValue={getVal('industry')} style={{width:'150px'}} /></label>
          <label>
            テーマ(GICS細分類): 
            <select name="gics_sub_industry" defaultValue={getVal('gics_sub_industry')} style={{width:'150px'}}>
              <option value="">すべて</option>
              {Object.entries(groupedGics).map(([sectorName, items]) => (
                <optgroup key={sectorName} label={sectorName}>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            市場: 
            <select name="market" defaultValue={getVal('market')}>
              <option value="">すべて</option>
              <option value="プライム">プライム</option>
              <option value="スタンダード">スタンダード</option>
              <option value="グロース">グロース</option>
            </select>
          </label>
        </div>

        {/* トレンド */}
        <div className="filter-section">
          <h4>トレンド</h4>
          <label><input type="checkbox" name="perfect_order" value="1" defaultChecked={isChecked('perfect_order')} /> パーフェクトオーダー</label>
          <label><input type="checkbox" name="above_sma25" value="1" defaultChecked={isChecked('above_sma25')} /> 株価25日線以上</label>
          <label><input type="checkbox" name="above_sma75" value="1" defaultChecked={isChecked('above_sma75')} /> 株価75日線以上</label>
          <label><input type="checkbox" name="above_sma200" value="1" defaultChecked={isChecked('above_sma200')} /> 株価200日線以上</label>
          <label><input type="checkbox" name="golden_cross" value="1" defaultChecked={isChecked('golden_cross')} /> ゴールデンクロス</label>
        </div>

        {/* モメンタム */}
        <div className="filter-section">
          <h4>モメンタム</h4>
          <label>RSI: <input type="number" name="rsi_min" placeholder="Min" defaultValue={getVal('rsi_min')} style={{width:'50px'}} /> ~ <input type="number" name="rsi_max" placeholder="Max" defaultValue={getVal('rsi_max')} style={{width:'50px'}} /></label>
          <label>ROC: <input type="number" name="roc_min" placeholder="Min" defaultValue={getVal('roc_min')} style={{width:'50px'}} /> ~ <input type="number" name="roc_max" placeholder="Max" defaultValue={getVal('roc_max')} style={{width:'50px'}} /></label>
          <label>5日騰落率(%): <input type="number" name="return_5d_min" placeholder="Min" defaultValue={getVal('return_5d_min')} style={{width:'70px'}} /></label>
          <label>20日騰落率(%): <input type="number" name="return_20d_min" placeholder="Min" defaultValue={getVal('return_20d_min')} style={{width:'70px'}} /></label>
        </div>

        {/* ブレイク */}
        <div className="filter-section">
          <h4>ブレイク</h4>
          <label><input type="checkbox" name="high_20d_update" value="1" defaultChecked={isChecked('high_20d_update')} /> 20日高値更新</label>
          <label><input type="checkbox" name="high_60d_update" value="1" defaultChecked={isChecked('high_60d_update')} /> 60日高値更新</label>
          <label><input type="checkbox" name="high_52w_update" value="1" defaultChecked={isChecked('high_52w_update')} /> 52週高値更新</label>
        </div>

        {/* 出来高 */}
        <div className="filter-section">
          <h4>出来高・売買代金</h4>
          <label>出来高倍率: <input type="number" name="volume_ratio_min" placeholder="Min" defaultValue={getVal('volume_ratio_min')} style={{width:'70px'}} /></label>
          <label>売買代金(億): <input type="number" name="trading_value_min" placeholder="Min" defaultValue={getVal('trading_value_min')} style={{width:'70px'}} /></label>
        </div>
      </div>
      
      <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>検索を適用</button>
    </form>
  );
}
