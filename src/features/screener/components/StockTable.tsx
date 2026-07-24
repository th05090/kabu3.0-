'use client';

import React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // プラスマイナスで色を分けるヘルパー関数
  const colorClass = (val: number) => {
    if (val > 0) return 'text-green';
    if (val < 0) return 'text-red';
    return '';
  };

  const boolToText = (val: boolean | number) => val ? '〇' : '-';

  const SortableHeader = ({ field, children, className }: { field: string, children: React.ReactNode, className?: string }) => {
    const currentSort = searchParams.get('sort');
    const currentOrder = searchParams.get('order');

    const handleClick = () => {
      const params = new URLSearchParams(searchParams.toString());
      if (currentSort === field) {
        if (currentOrder === 'desc') {
          params.set('order', 'asc');
        } else if (currentOrder === 'asc') {
          params.delete('sort');
          params.delete('order');
        } else {
          params.set('order', 'desc');
        }
      } else {
        params.set('sort', field);
        params.set('order', 'desc');
      }
      
      // Preserve page param if any, but reset to page 1 is often better when sorting
      params.set('page', '1');
      
      router.push(`${pathname}?${params.toString()}`);
    };

    let icon = '';
    if (currentSort === field) {
      icon = currentOrder === 'asc' ? ' ▲' : ' ▼';
    }

    return (
      <th 
        className={`${className || ''} cursor-pointer hover:bg-[var(--hover-bg)] select-none`} 
        onClick={handleClick}
        title="クリックしてソート"
      >
        <div className="flex items-center justify-between whitespace-nowrap">
          <span>{children}</span>
          <span className="text-xs text-[var(--primary)] ml-1 w-3 text-center">{icon}</span>
        </div>
      </th>
    );
  };

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
            <SortableHeader field="current_price">現在株価</SortableHeader>
            <SortableHeader field="market_cap">時価総額(億)</SortableHeader>
            <SortableHeader field="avg_trading_value_5d">5日平均売買(億)</SortableHeader>
            <SortableHeader field="revenue_growth_pct">売上成長率(%)</SortableHeader>
            <SortableHeader field="operating_profit_growth_pct">営利成長率(%)</SortableHeader>
            <SortableHeader field="operating_margin_pct">営業利益率(%)</SortableHeader>
            <SortableHeader field="eps_growth_pct">EPS成長率(%)</SortableHeader>
            <SortableHeader field="equity_ratio_pct">自己資本比率(%)</SortableHeader>
            <th>営業CF</th>
            <SortableHeader field="dividend_yield_pct">配当利回り(%)</SortableHeader>
            <SortableHeader field="forecast_achievement_pct">予想達成率(%)</SortableHeader>
            <SortableHeader field="earnings_reaction_pct">決算反応(%)</SortableHeader>
            <SortableHeader field="post_earnings_rise_pct">決算後上昇(%)</SortableHeader>
            <SortableHeader field="drop_from_post_earnings_high_pct">決算後高値から下落(%)</SortableHeader>
            <th>25日線</th>
            <SortableHeader field="is_above_sma_25">25日線上</SortableHeader>
            <SortableHeader field="sma_25_deviation_pct">25日乖離(%)</SortableHeader>
            <SortableHeader field="is_above_sma_75">75日線上</SortableHeader>
            <SortableHeader field="is_above_sma_200">200日線上</SortableHeader>
            <SortableHeader field="long_term_trend">長期トレンド</SortableHeader>
            <SortableHeader field="volume_ratio">出来高倍率</SortableHeader>
            <th>52週高値</th>
            <th>52週高値乖離</th>
            <SortableHeader field="distance_to_high_52w_pct">52週高値距離(%)</SortableHeader>
            <SortableHeader field="is_high_52w_update">52週高値更新</SortableHeader>
            <th>決算区分</th>
            <SortableHeader field="earnings_date">決算日</SortableHeader>
            <SortableHeader field="days_since_earnings">決算後日数</SortableHeader>
            <SortableHeader field="next_earnings_date_prediction">次回決算日予測</SortableHeader>
            <SortableHeader field="remaining_business_days">残り営業日</SortableHeader>
            <SortableHeader field="is_perfect_order">パーフェクトオーダー</SortableHeader>
            <SortableHeader field="is_golden_cross">ゴールデンクロス</SortableHeader>
            <SortableHeader field="rsi">RSI</SortableHeader>
            <SortableHeader field="roc">ROC</SortableHeader>
            <SortableHeader field="return_5d_pct">5日騰落率(%)</SortableHeader>
            <SortableHeader field="return_20d_pct">20日騰落率(%)</SortableHeader>
            <SortableHeader field="is_high_20d_update">20日高値更新</SortableHeader>
            <SortableHeader field="is_high_60d_update">60日高値更新</SortableHeader>
          </tr>
        </thead>
        <tbody>
          {data.map((stock) => {
            const fmt = (v: any, prefix='', suffix='') => v == null ? '-' : `${prefix}${Number(v).toLocaleString()}${suffix}`;
            const cls = (v: any) => v == null ? '' : colorClass(Number(v));
            return (
            <tr key={stock.ticker}>
              <td className="sticky-col">
                <Link 
                  href={`/stocks/${stock.ticker}`}
                  style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 'bold' }}
                >
                  {stock.ticker.slice(0, 4)}
                </Link>
              </td>
              <td className="sticky-col font-bold truncate" style={{ maxWidth: '180px' }} title={stock.name}>
                <Link href={`/stocks/${stock.ticker}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {stock.name}
                </Link>
              </td>
              <td>{stock.market}</td>
              <td>{stock.industry}</td>
              <td className="text-right font-mono">{fmt(stock.theme_score)}</td>
              <td className="text-right font-mono">{fmt(stock.current_price, '¥')}</td>
              <td className="text-right font-mono">{fmt(stock.market_cap)}</td>
              <td className="text-right font-mono">{fmt(stock.avg_trading_value_5d)}</td>
              <td className={`text-right font-mono ${cls(stock.revenue_growth_pct)}`}>{fmt(stock.revenue_growth_pct, '', '%')}</td>
              <td className={`text-right font-mono ${cls(stock.operating_profit_growth_pct)}`}>{fmt(stock.operating_profit_growth_pct, '', '%')}</td>
              <td className="text-right font-mono">{fmt(stock.operating_margin_pct, '', '%')}</td>
              <td className={`text-right font-mono ${cls(stock.eps_growth_pct)}`}>{fmt(stock.eps_growth_pct, '', '%')}</td>
              <td className="text-right font-mono">{fmt(stock.equity_ratio_pct, '', '%')}</td>
              <td className={`text-right font-mono ${cls(stock.operating_cf)}`}>{fmt(stock.operating_cf)}</td>
              <td className="text-right font-mono">{fmt(stock.dividend_yield_pct, '', '%')}</td>
              <td className="text-right font-mono">{fmt(stock.forecast_achievement_pct, '', '%')}</td>
              <td className={`text-right font-mono ${cls(stock.earnings_reaction_pct)}`}>{fmt(stock.earnings_reaction_pct, '', '%')}</td>
              <td className={`text-right font-mono ${cls(stock.post_earnings_rise_pct)}`}>{fmt(stock.post_earnings_rise_pct, '', '%')}</td>
              <td className={`text-right font-mono ${cls(stock.drop_from_post_earnings_high_pct)}`}>{fmt(stock.drop_from_post_earnings_high_pct, '', '%')}</td>
              <td className="text-right font-mono">{fmt(stock.sma_25, '¥')}</td>
              <td className="text-center">{boolToText(stock.is_above_sma_25)}</td>
              <td className={`text-right font-mono ${cls(stock.sma_25_deviation_pct)}`}>{fmt(stock.sma_25_deviation_pct, '', '%')}</td>
              <td className="text-center">{boolToText(stock.is_above_sma_75)}</td>
              <td className="text-center">{boolToText(stock.is_above_sma_200)}</td>
              <td>{stock.long_term_trend || '-'}</td>
              <td className="text-right font-mono">{fmt(stock.volume_ratio, '', 'x')}</td>
              <td className="text-right font-mono">{fmt(stock.high_52w, '¥')}</td>
              <td className={`text-right font-mono ${cls(stock.high_52w_deviation)}`}>{fmt(stock.high_52w_deviation)}</td>
              <td className={`text-right font-mono ${cls(stock.distance_to_high_52w_pct)}`}>{fmt(stock.distance_to_high_52w_pct, '', '%')}</td>
              <td className="text-center">{boolToText(stock.is_high_52w_update)}</td>
              <td>{stock.earnings_category || '-'}</td>
              <td>{stock.earnings_date || '-'}</td>
              <td className="text-right font-mono">{fmt(stock.days_since_earnings, '', '日')}</td>
              <td>{stock.next_earnings_date_prediction || '-'}</td>
              <td className="text-right font-mono">{fmt(stock.remaining_business_days, '', '日')}</td>
              <td className="text-center">{boolToText(stock.is_perfect_order)}</td>
              <td className="text-center">{boolToText(stock.is_golden_cross)}</td>
              <td className="text-right font-mono">{fmt(stock.rsi)}</td>
              <td className={`text-right font-mono ${cls(stock.roc)}`}>{fmt(stock.roc)}</td>
              <td className={`text-right font-mono ${cls(stock.return_5d_pct)}`}>{fmt(stock.return_5d_pct, '', '%')}</td>
              <td className={`text-right font-mono ${cls(stock.return_20d_pct)}`}>{fmt(stock.return_20d_pct, '', '%')}</td>
              <td className="text-center">{boolToText(stock.is_high_20d_update)}</td>
              <td className="text-center">{boolToText(stock.is_high_60d_update)}</td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}
