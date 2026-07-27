'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, IChartApi, ISeriesApi } from 'lightweight-charts';

interface PriceChartProps {
  data: any[];
}

export function PriceChart({ data }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const sanitizedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Find first valid data to initialize
    const firstValid = data.find(d => d.close != null) || data[0];
    
    let lastValidOpen = firstValid.open || 0;
    let lastValidHigh = firstValid.high || 0;
    let lastValidLow = firstValid.low || 0;
    let lastValidClose = firstValid.close || 0;
    let lastValidAdjOpen = firstValid.adj_open != null ? firstValid.adj_open : firstValid.open || 0;
    let lastValidAdjHigh = firstValid.adj_high != null ? firstValid.adj_high : firstValid.high || 0;
    let lastValidAdjLow = firstValid.adj_low != null ? firstValid.adj_low : firstValid.low || 0;
    let lastValidAdjClose = firstValid.adj_close != null ? firstValid.adj_close : firstValid.close || 0;

    return data.map((d) => {
      if (d.close != null) {
        lastValidOpen = d.open;
        lastValidHigh = d.high;
        lastValidLow = d.low;
        lastValidClose = d.close;
        lastValidAdjOpen = d.adj_open != null ? d.adj_open : d.open;
        lastValidAdjHigh = d.adj_high != null ? d.adj_high : d.high;
        lastValidAdjLow = d.adj_low != null ? d.adj_low : d.low;
        lastValidAdjClose = d.adj_close != null ? d.adj_close : d.close;
      }
      
      return {
        ...d,
        open: d.open != null ? d.open : lastValidOpen,
        high: d.high != null ? d.high : lastValidHigh,
        low: d.low != null ? d.low : lastValidLow,
        close: d.close != null ? d.close : lastValidClose,
        adj_open: d.adj_open != null ? d.adj_open : lastValidAdjOpen,
        adj_high: d.adj_high != null ? d.adj_high : lastValidAdjHigh,
        adj_low: d.adj_low != null ? d.adj_low : lastValidAdjLow,
        adj_close: d.adj_close != null ? d.adj_close : lastValidAdjClose,
      };
    });
  }, [data]);

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

  const candleData = useMemo(() => sanitizedData.map(d => ({
    time: d.date,
    open: d.adj_open || d.open,
    high: d.adj_high || d.high,
    low: d.adj_low || d.low,
    close: d.adj_close || d.close,
  })), [sanitizedData]);

  const volData = useMemo(() => sanitizedData.map(d => {
    const open = d.adj_open || d.open;
    const close = d.adj_close || d.close;
    return {
      time: d.date,
      value: d.adj_volume || d.volume,
      color: close >= open ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)',
    };
  }), [sanitizedData]);

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

  // Technical Indicator Math
  const calculateBB = (data: any[], period = 20, multiplier = 2) => {
    const upper = [];
    const lower = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = 0; j < period; j++) sum += (data[i - j].adj_close || data[i - j].close);
      const sma = sum / period;
      
      let sqSum = 0;
      for (let j = 0; j < period; j++) {
        const p = data[i - j].adj_close || data[i - j].close;
        sqSum += Math.pow(p - sma, 2);
      }
      const stdev = Math.sqrt(sqSum / period);
      
      upper.push({ time: data[i].date, value: sma + multiplier * stdev });
      lower.push({ time: data[i].date, value: sma - multiplier * stdev });
    }
    return { upper, lower };
  };

  const calculateEMA = (data: any[], period: number) => {
    const ema = [];
    let k = 2 / (period + 1);
    let prevEma = data[0].adj_close || data[0].close;
    
    for (let i = 0; i < data.length; i++) {
      const price = data[i].adj_close || data[i].close;
      if (i === 0) {
        ema.push({ time: data[i].date, value: price });
        continue;
      }
      prevEma = price * k + prevEma * (1 - k);
      ema.push({ time: data[i].date, value: prevEma });
    }
    return ema;
  };

  const calculateMACD = (data: any[], fast = 12, slow = 26, signal = 9) => {
    const fastEma = calculateEMA(data, fast);
    const slowEma = calculateEMA(data, slow);
    
    const macdLine = [];
    for (let i = 0; i < data.length; i++) {
      macdLine.push({ time: data[i].date, value: fastEma[i].value - slowEma[i].value });
    }
    
    // Signal is EMA of MACD line
    const signalEma = [];
    let k = 2 / (signal + 1);
    let prevEma = macdLine[0].value;
    for (let i = 0; i < macdLine.length; i++) {
      if (i === 0) {
        signalEma.push({ time: macdLine[i].time, value: prevEma });
        continue;
      }
      prevEma = macdLine[i].value * k + prevEma * (1 - k);
      signalEma.push({ time: macdLine[i].time, value: prevEma });
    }
    
    const hist = [];
    for (let i = 0; i < data.length; i++) {
      const val = macdLine[i].value - signalEma[i].value;
      hist.push({ 
        time: data[i].date, 
        value: val,
        color: val >= 0 ? 'rgba(74, 222, 128, 0.8)' : 'rgba(248, 113, 113, 0.8)'
      });
    }
    return { macdLine, signalLine: signalEma, hist };
  };

  const calculateATRStop = (data: any[], period = 14, multiplier = 2) => {
    const tr = [];
    const stopLoss = [];
    for (let i = 0; i < data.length; i++) {
      const h = data[i].adj_high || data[i].high;
      const l = data[i].adj_low || data[i].low;
      if (i === 0) {
        tr.push(h - l);
      } else {
        const prevC = data[i - 1].adj_close || data[i - 1].close;
        tr.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
      }
      
      if (i < period - 1) continue;
      
      // Simple SMA of TR for ATR
      let atrSum = 0;
      for (let j = 0; j < period; j++) atrSum += tr[i - j];
      const atr = atrSum / period;
      
      const price = data[i].adj_close || data[i].close;
      stopLoss.push({ time: data[i].date, value: price - (atr * multiplier) });
    }
    return stopLoss;
  };

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
        seriesRefs.current.sma25.setData(calculateSMA(sanitizedData, 25));
        seriesRefs.current.sma75.setData(calculateSMA(sanitizedData, 75));
        seriesRefs.current.sma200.setData(calculateSMA(sanitizedData, 200));
      }
    } else {
      if (seriesRefs.current.sma25) {
        chart.removeSeries(seriesRefs.current.sma25);
        chart.removeSeries(seriesRefs.current.sma75!);
        chart.removeSeries(seriesRefs.current.sma200!);
        seriesRefs.current.sma25 = null;
      }
    }

    // --- ATR Trailing Stop ---
    if (showATR) {
      if (!seriesRefs.current.atr) {
        seriesRefs.current.atr = chart.addSeries(LineSeries, { 
          color: '#f87171', lineWidth: 2, lineStyle: 2 /* Dashed */ 
        });
        seriesRefs.current.atr.setData(calculateATRStop(sanitizedData, 14, 2));
      }
    } else {
      if (seriesRefs.current.atr) {
        chart.removeSeries(seriesRefs.current.atr);
        seriesRefs.current.atr = null;
      }
    }

    // --- Bollinger Bands ---
    if (showBB) {
      if (!seriesRefs.current.bbUpper) {
        seriesRefs.current.bbUpper = chart.addSeries(LineSeries, { color: 'rgba(167, 139, 250, 0.5)', lineWidth: 1 });
        seriesRefs.current.bbLower = chart.addSeries(LineSeries, { color: 'rgba(167, 139, 250, 0.5)', lineWidth: 1 });
        const bb = calculateBB(sanitizedData, 20, 2);
        seriesRefs.current.bbUpper.setData(bb.upper);
        seriesRefs.current.bbLower.setData(bb.lower);
      }
    } else {
      if (seriesRefs.current.bbUpper) {
        chart.removeSeries(seriesRefs.current.bbUpper);
        chart.removeSeries(seriesRefs.current.bbLower!);
        seriesRefs.current.bbUpper = null;
      }
    }

    // --- MACD Subchart ---
    if (showMACD) {
      if (!seriesRefs.current.macdLine) {
        const macdLine = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 2, priceScaleId: 'macd' });
        const macdSignal = chart.addSeries(LineSeries, { color: '#f87171', lineWidth: 2, priceScaleId: 'macd' });
        const macdHist = chart.addSeries(HistogramSeries, { priceScaleId: 'macd' });
        
        chart.priceScale('macd').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        const macdData = calculateMACD(sanitizedData);

        macdLine.setData(macdData.macdLine);
        macdSignal.setData(macdData.signalLine);
        macdHist.setData(macdData.hist);
        
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

  }, [showSMA, showATR, showBB, showMACD, showRSI, sanitizedData]);

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
          ATR損切ライン(2x)
        </button>
        <button style={btnStyle(showBB)} onClick={() => setShowBB(!showBB)}>
          ボリンジャーバンド(2σ)
        </button>
        <button style={btnStyle(showMACD)} onClick={() => setShowMACD(!showMACD)}>
          MACD
        </button>
      </div>
      
      {/* Chart Container */}
      <div ref={chartContainerRef} style={{ width: '100%', flex: 1, minHeight: '400px' }} />
    </div>
  );
}
