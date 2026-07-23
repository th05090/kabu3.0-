'use client';

import React from 'react';

export function StockFilter() {
  return (
    <div className="filter-container">
      <h3>スクリーナー フィルタ</h3>
      
      <div className="filter-grid">
        {/* 基本フィルタ */}
        <div className="filter-section">
          <h4>基本</h4>
          <label>
            市場: 
            <select>
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
          <label><input type="checkbox" /> パーフェクトオーダー</label>
          <label><input type="checkbox" /> 株価25日線以上</label>
          <label><input type="checkbox" /> 株価75日線以上</label>
          <label><input type="checkbox" /> 株価200日線以上</label>
          <label><input type="checkbox" /> ゴールデンクロス</label>
        </div>

        {/* モメンタム */}
        <div className="filter-section">
          <h4>モメンタム</h4>
          <label>RSI: <input type="number" placeholder="Min" /> ~ <input type="number" placeholder="Max" /></label>
          <label>ROC: <input type="number" placeholder="Min" /> ~ <input type="number" placeholder="Max" /></label>
          <label>5日騰落率(%): <input type="number" placeholder="Min" /></label>
          <label>20日騰落率(%): <input type="number" placeholder="Min" /></label>
        </div>

        {/* ブレイク */}
        <div className="filter-section">
          <h4>ブレイク</h4>
          <label><input type="checkbox" /> 20日高値更新</label>
          <label><input type="checkbox" /> 60日高値更新</label>
          <label><input type="checkbox" /> 52週高値更新</label>
        </div>

        {/* 出来高 */}
        <div className="filter-section">
          <h4>出来高・売買代金</h4>
          <label>出来高倍率: <input type="number" placeholder="Min" /></label>
          <label>売買代金倍率: <input type="number" placeholder="Min" /></label>
        </div>
      </div>
      
      <button className="btn-primary" style={{ marginTop: '1rem' }}>検索を適用</button>
    </div>
  );
}
