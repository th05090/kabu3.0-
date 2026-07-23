'use client';

import React from 'react';

// DBから返される行の型（実際には不要なものも多いが網羅）
export type StockRow = {
  ticker: string;
  name: string;
  market: string;
  industry: string;
  theme: string;
  theme_score: number;
  current_price: number;
  market_cap: number;
  avg_trading_value_5d: number;
  volume_ratio: number;
  trading_value_ratio: number;
  revenue_growth_pct: number;
  operating_profit_growth_pct: number;
  operating_margin_pct: number;
  eps_growth_pct: number;
  equity_ratio_pct: number;
  operating_cf: number;
  dividend_yield_pct: number;
  forecast_achievement_pct: number;
  earnings_reaction_pct: number;
  post_earnings_rise_pct: number;
  drop_from_post_earnings_high_pct: number;
  earnings_category: string;
  earnings_date: string;
  days_since_earnings: number;
  next_earnings_date_prediction: string;
  remaining_business_days: number;
  sma_25: number;
  is_above_sma_25: boolean | number;
  sma_25_deviation_pct: number;
  is_above_sma_75: boolean | number;
  is_above_sma_200: boolean | number;
  long_term_trend: string;
  high_52w: number;
  high_52w_deviation: number;
  distance_to_high_52w_pct: number;
  is_high_52w_update: boolean | number;
  is_perfect_order: boolean | number;
  is_golden_cross: boolean | number;
  rsi: number;
  roc: number;
  return_5d_pct: number;
  return_20d_pct: number;
  is_high_20d_update: boolean | number;
  is_high_60d_update: boolean | number;
};

export function StockTable({ data }: { data: StockRow[] }) {
  // プラスマイナスで色を分けるヘルパー関数
  const colorClass = (val: number) => {
    if (val > 0) return 'text-green';
    if (val < 0) return 'text-red';
    return '';
  };

  const boolToText = (val: boolean | number) => val ? '〇' : '-';

  return (
    <div className="table-container">
      <table className="stock-table">
        <thead>
          <tr>
            <th className="sticky-col">銘柄コード</th>
            <th className="sticky-col">銘柄名</th>
            <th>市場</th>
            <th>業種(テーマ)</th>
            <th>テーマ点</th>
            <th>現在株価</th>
            <th>時価総額(億)</th>
            <th>5日平均売買(億)</th>
            <th>売上成長率(%)</th>
            <th>営利成長率(%)</th>
            <th>営業利益率(%)</th>
            <th>EPS成長率(%)</th>
            <th>自己資本比率(%)</th>
            <th>営業CF</th>
            <th>配当利回り(%)</th>
            <th>予想達成率(%)</th>
            <th>決算反応(%)</th>
            <th>決算後上昇(%)</th>
            <th>決算後高値から下落(%)</th>
            <th>25日線</th>
            <th>25日線上</th>
            <th>25日乖離(%)</th>
            <th>75日線上</th>
            <th>200日線上</th>
            <th>長期トレンド</th>
            <th>出来高倍率</th>
            <th>52週高値</th>
            <th>52週高値乖離</th>
            <th>52週高値距離(%)</th>
            <th>52週高値更新</th>
            <th>決算区分</th>
            <th>決算日</th>
            <th>決算後日数</th>
            <th>次回決算日予測</th>
            <th>残り営業日</th>
            <th>パーフェクトオーダー</th>
            <th>ゴールデンクロス</th>
            <th>RSI</th>
            <th>ROC</th>
            <th>5日騰落率(%)</th>
            <th>20日騰落率(%)</th>
            <th>20日高値更新</th>
            <th>60日高値更新</th>
          </tr>
        </thead>
        <tbody>
          {data.map((stock) => (
            <tr key={stock.ticker}>
              <td className="sticky-col">{stock.ticker}</td>
              <td className="sticky-col font-bold">{stock.name}</td>
              <td>{stock.market}</td>
              <td>{stock.industry}</td>
              <td className="text-right font-mono">{stock.theme_score}</td>
              <td className="text-right font-mono">¥{stock.current_price.toLocaleString()}</td>
              <td className="text-right font-mono">{stock.market_cap.toLocaleString()}</td>
              <td className="text-right font-mono">{stock.avg_trading_value_5d.toLocaleString()}</td>
              <td className={`text-right font-mono ${colorClass(stock.revenue_growth_pct)}`}>{stock.revenue_growth_pct}%</td>
              <td className={`text-right font-mono ${colorClass(stock.operating_profit_growth_pct)}`}>{stock.operating_profit_growth_pct}%</td>
              <td className="text-right font-mono">{stock.operating_margin_pct}%</td>
              <td className={`text-right font-mono ${colorClass(stock.eps_growth_pct)}`}>{stock.eps_growth_pct}%</td>
              <td className="text-right font-mono">{stock.equity_ratio_pct}%</td>
              <td className={`text-right font-mono ${colorClass(stock.operating_cf)}`}>{stock.operating_cf.toLocaleString()}</td>
              <td className="text-right font-mono">{stock.dividend_yield_pct}%</td>
              <td className="text-right font-mono">{stock.forecast_achievement_pct}%</td>
              <td className={`text-right font-mono ${colorClass(stock.earnings_reaction_pct)}`}>{stock.earnings_reaction_pct}%</td>
              <td className={`text-right font-mono ${colorClass(stock.post_earnings_rise_pct)}`}>{stock.post_earnings_rise_pct}%</td>
              <td className={`text-right font-mono ${colorClass(stock.drop_from_post_earnings_high_pct)}`}>{stock.drop_from_post_earnings_high_pct}%</td>
              <td className="text-right font-mono">¥{stock.sma_25.toLocaleString()}</td>
              <td className="text-center">{boolToText(stock.is_above_sma_25)}</td>
              <td className={`text-right font-mono ${colorClass(stock.sma_25_deviation_pct)}`}>{stock.sma_25_deviation_pct}%</td>
              <td className="text-center">{boolToText(stock.is_above_sma_75)}</td>
              <td className="text-center">{boolToText(stock.is_above_sma_200)}</td>
              <td>{stock.long_term_trend}</td>
              <td className="text-right font-mono">{stock.volume_ratio}x</td>
              <td className="text-right font-mono">¥{stock.high_52w.toLocaleString()}</td>
              <td className={`text-right font-mono ${colorClass(stock.high_52w_deviation)}`}>{stock.high_52w_deviation}</td>
              <td className={`text-right font-mono ${colorClass(stock.distance_to_high_52w_pct)}`}>{stock.distance_to_high_52w_pct}%</td>
              <td className="text-center">{boolToText(stock.is_high_52w_update)}</td>
              <td>{stock.earnings_category}</td>
              <td>{stock.earnings_date}</td>
              <td className="text-right font-mono">{stock.days_since_earnings}日</td>
              <td>{stock.next_earnings_date_prediction}</td>
              <td className="text-right font-mono">{stock.remaining_business_days}日</td>
              <td className="text-center">{boolToText(stock.is_perfect_order)}</td>
              <td className="text-center">{boolToText(stock.is_golden_cross)}</td>
              <td className="text-right font-mono">{stock.rsi}</td>
              <td className={`text-right font-mono ${colorClass(stock.roc)}`}>{stock.roc}</td>
              <td className={`text-right font-mono ${colorClass(stock.return_5d_pct)}`}>{stock.return_5d_pct}%</td>
              <td className={`text-right font-mono ${colorClass(stock.return_20d_pct)}`}>{stock.return_20d_pct}%</td>
              <td className="text-center">{boolToText(stock.is_high_20d_update)}</td>
              <td className="text-center">{boolToText(stock.is_high_60d_update)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
