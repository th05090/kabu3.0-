'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, CrosshairMode } from 'lightweight-charts';

interface SepaPriceChartProps {
  quotes: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  pivotPrice: number | null;
  baseHigh?: number | null;
}

export function SepaPriceChart({ quotes, pivotPrice, baseHigh }: SepaPriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || quotes.length === 0) return;

    // 軽量チャート初期化
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
      },
      width: containerRef.current.clientWidth,
      height: 380,
    });

    const sorted = [...quotes].sort((a, b) => a.date.localeCompare(b.date));

    // 1. ローソク足シリーズ
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    candleSeries.setData(
      sorted.map(q => ({
        time: q.date,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
      }))
    );

    // 2. 移動平均線 (SMA 50, 150, 200)
    const calcSma = (period: number) => {
      const smaData: { time: string; value: number }[] = [];
      for (let i = period - 1; i < sorted.length; i++) {
        const slice = sorted.slice(i - period + 1, i + 1);
        const avg = slice.reduce((sum, q) => sum + q.close, 0) / period;
        smaData.push({ time: sorted[i].date, value: Math.round(avg * 10) / 10 });
      }
      return smaData;
    };

    // 25日SMA (紫 / 短期サポートライン)
    if (sorted.length >= 25) {
      const sma25Series = chart.addSeries(LineSeries, {
        color: '#a855f7',
        lineWidth: 2,
        title: '25 SMA',
      });
      sma25Series.setData(calcSma(25));
    }

    // 50日SMA (緑)
    if (sorted.length >= 50) {
      const sma50Series = chart.addSeries(LineSeries, {
        color: '#10b981',
        lineWidth: 2,
        title: '50 SMA',
      });
      sma50Series.setData(calcSma(50));
    }

    // 150日SMA (青/シアン)
    if (sorted.length >= 150) {
      const sma150Series = chart.addSeries(LineSeries, {
        color: '#06b6d4',
        lineWidth: 2,
        title: '150 SMA',
      });
      sma150Series.setData(calcSma(150));
    }

    // 200日SMA (赤/ローズ)
    if (sorted.length >= 200) {
      const sma200Series = chart.addSeries(LineSeries, {
        color: '#f43f5e',
        lineWidth: 2,
        title: '200 SMA',
      });
      sma200Series.setData(calcSma(200));
    }

    // ベース高値ライン (水平点線: オレンジ / 過去65日最高値)
    if (baseHigh && baseHigh > 0 && baseHigh !== pivotPrice) {
      candleSeries.createPriceLine({
        price: baseHigh,
        color: '#f97316',
        lineWidth: 1,
        lineStyle: 1, // 点線
        axisLabelVisible: true,
        title: `BASE HIGH ${baseHigh.toLocaleString()}円`,
      });
    }

    // 真のピボットライン (水平破線: ゴールド / ハンドル高値)
    if (pivotPrice && pivotPrice > 0) {
      candleSeries.createPriceLine({
        price: pivotPrice,
        color: '#fbbf24',
        lineWidth: 2,
        lineStyle: 2, // 破線
        axisLabelVisible: true,
        title: `真のピボット ${pivotPrice.toLocaleString()}円`,
      });
    }

    // 3. 出来高シリーズ (下部20%)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    chart.priceScale('').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    volumeSeries.setData(
      sorted.map(q => ({
        time: q.date,
        value: q.volume,
        color: q.close >= q.open ? '#10b98144' : '#ef444444',
      }))
    );

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [quotes, pivotPrice, baseHigh]);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', padding: '0 0.25rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '12px', height: '3px', background: '#a855f7', borderRadius: '2px' }} /> 25 SMA
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '12px', height: '3px', background: '#10b981', borderRadius: '2px' }} /> 50 SMA
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '12px', height: '3px', background: '#06b6d4', borderRadius: '2px' }} /> 150 SMA
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '12px', height: '3px', background: '#f43f5e', borderRadius: '2px' }} /> 200 SMA
        </span>
        {baseHigh && baseHigh !== pivotPrice && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f97316' }}>
            <span style={{ width: '12px', height: '2px', background: '#f97316', borderBottom: '1px dotted #f97316' }} /> ベース高値 ({baseHigh.toLocaleString()}円)
          </span>
        )}
        {pivotPrice && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#fbbf24' }}>
            <span style={{ width: '12px', height: '3px', background: '#fbbf24', borderRadius: '2px', borderBottom: '1px dashed #fbbf24' }} /> 真のピボット ({pivotPrice.toLocaleString()}円)
          </span>
        )}
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '380px', borderRadius: '6px', border: '1px solid var(--border)', background: '#09090b', overflow: 'hidden' }} />
    </div>
  );
}
