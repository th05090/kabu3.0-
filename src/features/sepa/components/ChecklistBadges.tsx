import React from 'react';
import { SepaTrendMetrics, SepaRsMetrics } from '../types/sepa';

interface ChecklistBadgesProps {
  trend: SepaTrendMetrics;
  rs: SepaRsMetrics;
}

export function ChecklistBadges({ trend, rs }: ChecklistBadgesProps) {
  const isHighCondition = trend.distance_to_high_52w_pct != null && trend.distance_to_high_52w_pct >= -25;
  const isLowCondition = trend.distance_from_low_52w_pct != null && trend.distance_from_low_52w_pct >= 25;
  const isRsCondition = rs.rs_rating != null && rs.rs_rating >= 70;

  if (trend.is_ipo) {
    return (
      <div className="sepa-badge-list">
        <span className="sepa-badge-ipo">
          IPO急成長株
        </span>
        <span className={trend.is_above_sma_50 ? 'sepa-badge-pass' : 'sepa-badge-fail'}>
          株価 &gt; 50SMA
        </span>
        <span className={isHighCondition ? 'sepa-badge-pass' : 'sepa-badge-fail'}>
          最高値-25%以内
        </span>
        <span className={isLowCondition ? 'sepa-badge-pass' : 'sepa-badge-fail'}>
          最安値+25%以上
        </span>
        {rs.rs_rating != null && (
          <span className={isRsCondition ? 'sepa-badge-pass' : 'sepa-badge-fail'}>
            擬似RS {rs.rs_rating}
          </span>
        )}
      </div>
    );
  }

  const items = [
    { label: '株価 > 150/200', pass: trend.is_above_sma_150 && trend.is_above_sma_200 },
    { label: '150 > 200', pass: trend.is_sma_150_above_200 },
    { label: '200日線上向き', pass: trend.is_sma200_uptrend_1m },
    { label: '50 > 150/200', pass: trend.is_sma_50_above_150_200 },
    { label: '株価 > 50', pass: trend.is_above_sma_50 },
    { label: '52週安値 +25%', pass: isLowCondition },
    { label: '52週高値 -25%', pass: isHighCondition },
    { label: 'RS >= 70', pass: isRsCondition },
  ];

  return (
    <div className="sepa-badge-list">
      {items.map((item, idx) => (
        <span
          key={idx}
          className={item.pass ? 'sepa-badge-pass' : 'sepa-badge-fail'}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
