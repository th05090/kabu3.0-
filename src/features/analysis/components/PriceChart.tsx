'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, IChartApi, ISeriesApi } from 'lightweight-charts';

interface PriceChartProps {
  data: any[];
}

export function PriceChart({ data }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Toggles state
  const [showSMA, setShowSMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showATR, setShowATR] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showRSI, setShowRSI] = useState(false);

  // Series Refs
  const seriesRefs = useRef<Record<string, ISeriesApi<any> | null>>({});

  // Helper to calculate SMA
  const calculateSMA = (data: any[], period: number) => {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += (data[i - j].adj_close || data[i - j].close);
      }
      result.push({ time: data[i].date, value: sum / period });
    }
    return result;
  };

  // Helper to generate a dummy line (e.g. for ATR mock)
  const generateDummyLine = (data: any[], offsetPct: number) => {
    return data.map(d => ({
      time: d.date,
      value: (d.adj_close || d.close) * (1 - offsetPct) // Dummy stop loss below price
    }));
  };

  const candleData = useMemo(() => data.map(d => ({
    time: d.date,
    open: d.adj_open || d.open,
    high: d.adj_high || d.high,
    low: d.adj_low || d.low,
    close: d.adj_close || d.close,
  })), [data]);

  const volData = useMemo(() => data.map(d => {
    const open = d.adj_open || d.open;
    const close = d.adj_close || d.close;
    return {
      time: d.date,
      value: d.adj_volume || d.volume,
      color: close >= open ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)',
    };
  }), [data]);

  // Initialization
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#cbd5e1',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        scaleMargins: { top: 0.1, bottom: 0.3 }, // Leave room at bottom for volume and sub-charts
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
      },
      crosshair: { mode: 0 }
    });
    chartRef.current = chart;

    // Main Candlestick
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderVisible: false,
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    });
    candlestickSeries.setData(candleData);
    seriesRefs.current.candle = candlestickSeries;

    // Volume
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.7, bottom: 0 } });
    volumeSeries.setData(volData);
    seriesRefs.current.volume = volumeSeries;

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      seriesRefs.current = {};
    };
  }, [candleData, volData]);

  // Effect for Toggles (Adding/Removing Series dynamically)
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    // --- SMA ---
    if (showSMA) {
      if (!seriesRefs.current.sma25) {
        seriesRefs.current.sma25 = chart.addSeries(LineSeries, { color: '#facc15', lineWidth: 2, crosshairMarkerVisible: false });
        seriesRefs.current.sma75 = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 2, crosshairMarkerVisible: false });
        seriesRefs.current.sma200 = chart.addSeries(LineSeries, { color: '#c084fc', lineWidth: 2, crosshairMarkerVisible: false });
        seriesRefs.current.sma25.setData(calculateSMA(data, 25));
        seriesRefs.current.sma75.setData(calculateSMA(data, 75));
        seriesRefs.current.sma200.setData(calculateSMA(data, 200));
      }
    } else {
      if (seriesRefs.current.sma25) {
        chart.removeSeries(seriesRefs.current.sma25);
        chart.removeSeries(seriesRefs.current.sma75!);
        chart.removeSeries(seriesRefs.current.sma200!);
        seriesRefs.current.sma25 = null;
      }
    }

    // --- ATR Trailing Stop (Mock) ---
    if (showATR) {
      if (!seriesRefs.current.atr) {
        seriesRefs.current.atr = chart.addSeries(LineSeries, { 
          color: '#f87171', lineWidth: 2, lineStyle: 2 /* Dashed */ 
        });
        seriesRefs.current.atr.setData(generateDummyLine(data, 0.05)); // Mocked 5% trailing stop
      }
    } else {
      if (seriesRefs.current.atr) {
        chart.removeSeries(seriesRefs.current.atr);
        seriesRefs.current.atr = null;
      }
    }

    // --- Bollinger Bands (Mock) ---
    if (showBB) {
      if (!seriesRefs.current.bbUpper) {
        seriesRefs.current.bbUpper = chart.addSeries(LineSeries, { color: 'rgba(167, 139, 250, 0.5)', lineWidth: 1 });
        seriesRefs.current.bbLower = chart.addSeries(LineSeries, { color: 'rgba(167, 139, 250, 0.5)', lineWidth: 1 });
        seriesRefs.current.bbUpper.setData(generateDummyLine(data, -0.08)); // +8% Mock
        seriesRefs.current.bbLower.setData(generateDummyLine(data, 0.08));  // -8% Mock
      }
    } else {
      if (seriesRefs.current.bbUpper) {
        chart.removeSeries(seriesRefs.current.bbUpper);
        chart.removeSeries(seriesRefs.current.bbLower!);
        seriesRefs.current.bbUpper = null;
      }
    }

    // --- MACD Subchart (Mock) ---
    if (showMACD) {
      if (!seriesRefs.current.macdLine) {
        // Create a custom price scale for MACD to place it at the bottom
        const macdLine = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 2, priceScaleId: 'macd' });
        const macdSignal = chart.addSeries(LineSeries, { color: '#f87171', lineWidth: 2, priceScaleId: 'macd' });
        const macdHist = chart.addSeries(HistogramSeries, { priceScaleId: 'macd' });
        
        chart.priceScale('macd').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        // Generate mock oscillator data around 0
        const histData = data.map((d, i) => ({ time: d.date, value: Math.sin(i / 10) * 5, color: Math.sin(i / 10) > 0 ? '#4ade80' : '#f87171' }));
        const lineData = data.map((d, i) => ({ time: d.date, value: Math.sin(i / 10) * 10 }));
        const sigData = data.map((d, i) => ({ time: d.date, value: Math.sin((i-3) / 10) * 10 }));

        macdLine.setData(lineData);
        macdSignal.setData(sigData);
        macdHist.setData(histData);
        
        seriesRefs.current.macdLine = macdLine;
        seriesRefs.current.macdSignal = macdSignal;
        seriesRefs.current.macdHist = macdHist;
        
        // Adjust main chart to make room
        chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.4 } });
        chart.priceScale('').applyOptions({ scaleMargins: { top: 0.5, bottom: 0.2 } }); // Volume
      }
    } else {
      if (seriesRefs.current.macdLine) {
        chart.removeSeries(seriesRefs.current.macdLine);
        chart.removeSeries(seriesRefs.current.macdSignal!);
        chart.removeSeries(seriesRefs.current.macdHist!);
        seriesRefs.current.macdLine = null;
        
        // Restore margins
        chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.3 } });
        chart.priceScale('').applyOptions({ scaleMargins: { top: 0.7, bottom: 0 } }); // Volume
      }
    }

  }, [showSMA, showATR, showBB, showMACD, showRSI, data]);

  // CSS for custom toggles
  const btnStyle = (active: boolean) => ({
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    background: active ? '#3b82f6' : 'rgba(255,255,255,0.1)',
    color: active ? '#fff' : '#aaa',
    border: 'none',
    marginRight: '8px',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Chart Tools Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px', paddingLeft: '8px' }}>
        <button style={btnStyle(showSMA)} onClick={() => setShowSMA(!showSMA)}>
          SMA (25, 75, 200)
        </button>
        <button style={btnStyle(showATR)} onClick={() => setShowATR(!showATR)}>
          ATR損切ライン (Mock)
        </button>
        <button style={btnStyle(showBB)} onClick={() => setShowBB(!showBB)}>
          Bollinger Bands (Mock)
        </button>
        <button style={btnStyle(showMACD)} onClick={() => setShowMACD(!showMACD)}>
          MACD (Mock)
        </button>
        {/* <button style={btnStyle(showRSI)} onClick={() => setShowRSI(!showRSI)}>
          RSI (Mock)
        </button> */}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#666', alignSelf: 'center' }}>
          ※Mockはダミー描画です
        </span>
      </div>
      
      {/* Chart Container */}
      <div ref={chartContainerRef} style={{ width: '100%', flex: 1, minHeight: '400px' }} />
    </div>
  );
}
