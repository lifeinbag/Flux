import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import API from '../services/api';
import { connectWS, onMessage, subscribeToPremium } from '../services/wsService';
import { TrendingUp, ZoomIn, ZoomOut, Maximize2, RotateCcw, Minus, BarChart3, Settings, TrendingDown, Activity, Volume2, Download, Eye, EyeOff } from 'lucide-react';

export default function SellPremiumChart({
  timeframe = 15,
  company,
  accountSetId,
  currentSet,
  debug = false,
  daysToFetch = 30,
  maxPoints = 5000
}) {
  // Basic state
  const [candles, setCandles] = useState([]);
  const [latestCandle, setLatestCandle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tf, setTf] = useState(timeframe);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Enhanced chart features
  const [chartType, setChartType] = useState('candlestick');
  const [indicators, setIndicators] = useState({
    sma20: false,
    sma50: false,
    ema12: false,
    ema26: false,
    rsi: false,
    volume: false
  });
  const [showVolume, setShowVolume] = useState(false);
  
  // Drawing tools - enhanced
  const [drawingMode, setDrawingMode] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawings, setDrawings] = useState([]);
  const [drawingPoints, setDrawingPoints] = useState([]);
  
  // Refs
  const chartContainer = useRef();
  const chartRef = useRef();
  const seriesRef = useRef();
  const volumeSeriesRef = useRef();
  const indicatorSeriesRefs = useRef({});
  const resizeObserver = useRef();
  const initialLoaded = useRef(false);
  const lastCandleTimeRef = useRef(null);
  const refreshIntervalRef = useRef(null);
  
  // Real-time update highlighting
  const [lastUpdate, setLastUpdate] = useState(null);
  const [currentCandleHighlight, setCurrentCandleHighlight] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(null);
  
  // Simple timeframes
  const timeframes = [
    { value: 1, label: '1m' },
    { value: 5, label: '5m' },
    { value: 15, label: '15m' },
    { value: 30, label: '30m' },
    { value: 60, label: '1h' },
    { value: 240, label: '4h' },
    { value: 1440, label: '1d' }
  ];
  
  // Status colors and labels
  const getStatusInfo = () => {
    switch (connectionStatus) {
      case 'connected': return { color: '#22c55e', label: 'Connected', icon: '🟢' };
      case 'live': return { color: '#3b82f6', label: 'Live Updates', icon: '🔵' };
      case 'error': return { color: '#ef4444', label: 'Connection Error', icon: '🔴' };
      case 'no-data': return { color: '#f59e0b', label: 'No Data', icon: '🟡' };
      case 'connecting': return { color: '#6b7280', label: 'Connecting...', icon: '⚪' };
      default: return { color: '#6b7280', label: 'Unknown', icon: '⚪' };
    }
  };

  // Technical indicator calculations
  const calculateSMA = (data, period) => {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.close, 0);
      result.push({
        time: data[i].time,
        value: sum / period
      });
    }
    return result;
  };

  const calculateEMA = (data, period) => {
    if (data.length === 0) return [];
    const result = [];
    const multiplier = 2 / (period + 1);
    let ema = data[0].close;
    
    result.push({ time: data[0].time, value: ema });
    
    for (let i = 1; i < data.length; i++) {
      ema = (data[i].close - ema) * multiplier + ema;
      result.push({
        time: data[i].time,
        value: ema
      });
    }
    return result;
  };

  const calculateRSI = (data, period = 14) => {
    if (data.length <= period) return [];
    
    const result = [];
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    for (let i = period; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      
      result.push({
        time: data[i].time,
        value: rsi
      });
    }
    return result;
  };

  const generateVolumeData = (candleData) => {
    return candleData.map(candle => ({
      time: candle.time,
      value: Math.random() * 1000000 + 500000,
      color: candle.close >= candle.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
    }));
  };

  // Fetch candles from database
  const fetchCandles = useCallback(async () => {
    if (!accountSetId) {
      console.log('Missing accountSetId');
      return;
    }
    
    console.log(`📊 Fetching candles: ${tf}m timeframe for accountSet ${accountSetId}`);
    setLoading(true);
    setError('');
    
    try {
      const response = await API.get('/premium-candles', {
        params: {
          tf: tf,
          accountSetId: accountSetId,
          days: daysToFetch,
          limit: maxPoints
        }
      });
      
      if (response.data?.success && response.data?.data) {
        const candleData = response.data.data
          .map(bar => ({
            time: Number(bar.time),
            open: Number(bar.open) || Number(bar.close) || 0,
            high: Number(bar.high) || Number(bar.close) || 0,
            low: Number(bar.low) || Number(bar.close) || 0,
            close: Number(bar.close) || 0,
          }))
          // Sort by time and remove duplicates
          .sort((a, b) => a.time - b.time)
          .filter((item, index, self) => 
            index === 0 || item.time > self[index - 1].time
          );
        
        console.log(`✅ Loaded ${candleData.length} candles`);
        setCandles(candleData);
        const lastCandle = candleData[candleData.length - 1] || null;
        setLatestCandle(lastCandle);
        
        // Set current price from latest historical candle if available
        if (lastCandle && !currentPrice) {
          setCurrentPrice(lastCandle.close);
        }
        
        setConnectionStatus('connected');
        initialLoaded.current = false; // Reset for new data
      } else {
        console.warn('No candle data received');
        setCandles([]);
        setLatestCandle(null);
        setConnectionStatus('no-data');
      }
    } catch (err) {
      console.error('Error fetching candles:', err);
      setError('Failed to load chart data');
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  }, [tf, accountSetId, daysToFetch, maxPoints]);

  // Handle real-time updates with enhanced highlighting
  const handleRealtimeUpdate = useCallback((data) => {
    if (!seriesRef.current || !chartRef.current) return;
    
    // Handle premium update data structure - server sends 'sellpremium' (lowercase)
    const price = data.sellpremium ?? data.sellPremium ?? data.sell_premium ?? data.premium;
    if (!price || isNaN(parseFloat(price))) {
      console.log('⚠️ Invalid premium price data received:', data);
      console.log('📋 Available data fields:', Object.keys(data));
      return;
    }
    
    const newPrice = parseFloat(price);
    const nowSec = Math.floor(Date.now() / 1000);
    const intervalSec = tf * 60;
    const candleTimeSec = Math.floor(nowSec / intervalSec) * intervalSec;
    
    console.log(`📊 Real-time update: price=${newPrice}, candleTime=${candleTimeSec}, tf=${tf}m`);
    
    // Update current price
    setCurrentPrice(newPrice);
    
    // Visual feedback
    setCurrentCandleHighlight(true);
    setLastUpdate(Date.now());
    setTimeout(() => setCurrentCandleHighlight(false), 1000);
    
    // Get current candles from state to ensure sync
    setCandles(currentCandles => {
      const updatedCandles = [...currentCandles];
      const lastCandle = updatedCandles[updatedCandles.length - 1];
      
      if (!lastCandle || lastCandle.time !== candleTimeSec) {
        // New candle period - create new candle
        console.log('🆕 Creating new real-time candle');
        
        // If this is a completely new time period, refresh historical data
        if (lastCandleTimeRef.current && lastCandleTimeRef.current !== candleTimeSec) {
          console.log('🔄 New candle period detected, refreshing historical data...');
          // Trigger historical data refresh after a short delay
          setTimeout(() => {
            fetchCandles();
          }, 2000);
        }
        
        lastCandleTimeRef.current = candleTimeSec;
        
        const newCandle = { 
          time: candleTimeSec, 
          open: newPrice, 
          high: newPrice, 
          low: newPrice, 
          close: newPrice,
          isRealTime: true
        };
        
        updatedCandles.push(newCandle);
        seriesRef.current.update(newCandle);
        setLatestCandle(newCandle);
        
        // Auto-scroll to show new candle
        chartRef.current.timeScale().scrollToRealTime();
        
      } else {
        // Update existing candle in same period
        console.log('🔄 Updating existing real-time candle');
        const updatedCandle = {
          time: candleTimeSec,
          open: lastCandle.open,
          high: Math.max(lastCandle.high, newPrice),
          low: Math.min(lastCandle.low, newPrice),
          close: newPrice,
          isRealTime: true
        };
        
        updatedCandles[updatedCandles.length - 1] = updatedCandle;
        seriesRef.current.update(updatedCandle);
        setLatestCandle(updatedCandle);
      }
      
      return updatedCandles;
    });
    
    setConnectionStatus('live');
  }, [tf]);

  // Chart initialization (once only)
  useEffect(() => {
    if (!chartContainer.current) return;

    console.log('🎨 Initializing enhanced chart...');

    const chart = createChart(chartContainer.current, {
      width: chartContainer.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      timeScale: {
        timeVisible: true,
        borderColor: '#3a3a3a',
        fixLeftEdge: true,
        fixRightEdge: false,
      },
      rightPriceScale: {
        borderColor: '#3a3a3a',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      leftPriceScale: {
        visible: true,
        borderColor: '#3a3a3a',
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#758696',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: 3,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      priceScaleId: 'right',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;
    indicatorSeriesRefs.current = {};

    chart.subscribeClick((param) => {
      if (!drawingMode || !param.time) return;
      
      const price = param.seriesData?.get(candlestickSeries)?.close;
      if (!price) return;
      
      console.log(`Drawing ${drawingMode} at time: ${param.time}, price: ${price}`);
      
      if (drawingMode === 'horizontal') {
        const priceLine = candlestickSeries.createPriceLine({
          price: price,
          color: '#2196F3',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `Support/Resistance @ ${price.toFixed(5)}`,
        });
        
        setDrawings(prev => [...prev, {
          id: Date.now(),
          type: 'horizontal',
          price: price,
          priceLine: priceLine
        }]);
        
        setDrawingMode(null);
      } else if (drawingMode === 'trendline') {
        if (drawingPoints.length === 0) {
          setDrawingPoints([{ time: param.time, price: price }]);
          setIsDrawing(true);
        } else if (drawingPoints.length === 1) {
          const firstPoint = drawingPoints[0];
          const lineSeries = chartRef.current.addLineSeries({
            color: '#FF9800',
            lineWidth: 2,
            title: 'Trend Line',
          });
          
          lineSeries.setData([
            { time: firstPoint.time, value: firstPoint.price },
            { time: param.time, value: price }
          ]);
          
          setDrawings(prev => [...prev, {
            id: Date.now(),
            type: 'trendline',
            points: [firstPoint, { time: param.time, price: price }],
            priceLine: lineSeries
          }]);
          
          setDrawingPoints([]);
          setDrawingMode(null);
          setIsDrawing(false);
        }
      }
    });

    resizeObserver.current = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    
    resizeObserver.current.observe(chartContainer.current);

    console.log('✅ Enhanced chart initialized');

    return () => {
      resizeObserver.current?.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRefs.current = {};
    };
  }, []);

  // Update chart options for volume and fullscreen
  useEffect(() => {
    if (!chartRef.current) return;

    const chartHeight = showVolume ? (isFullscreen ? 'calc(100vh - 120px)' : '500px') : 
                       isFullscreen ? 'calc(100vh - 120px)' : '400px';

    chartRef.current.applyOptions({
      height: parseInt(chartHeight) || 400,
      rightPriceScale: {
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.4 : 0.1,
        },
      },
    });

    if (showVolume && !volumeSeriesRef.current) {
      const volumeSeries = chartRef.current.addHistogramSeries({
        color: 'rgba(76, 175, 80, 0.5)',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'left',
        scaleMargins: {
          top: 0.7,
          bottom: 0,
        },
      });
      volumeSeriesRef.current = volumeSeries;
    } else if (!showVolume && volumeSeriesRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
  }, [showVolume, isFullscreen]);

  // Update highlight colors
  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.applyOptions({
      upColor: currentCandleHighlight ? '#00ff88' : '#26a69a',
      downColor: currentCandleHighlight ? '#ff4444' : '#ef5350',
      wickUpColor: currentCandleHighlight ? '#00ff88' : '#26a69a',
      wickDownColor: currentCandleHighlight ? '#ff4444' : '#ef5350',
    });
  }, [currentCandleHighlight]);

  // Initial data load
  useEffect(() => {
    if (!seriesRef.current || initialLoaded.current || candles.length === 0) return;

    console.log(`📈 Setting initial chart data with ${candles.length} candles`);
    seriesRef.current.setData(candles);
    initialLoaded.current = true;

    if (volumeSeriesRef.current && showVolume) {
      const volumeData = generateVolumeData(candles);
      volumeSeriesRef.current.setData(volumeData);
    }

    if (indicators.sma20 && chartRef.current) {
      const sma20Data = calculateSMA(candles, 20);
      if (!indicatorSeriesRefs.current.sma20) {
        indicatorSeriesRefs.current.sma20 = chartRef.current.addLineSeries({
          color: '#2196F3',
          lineWidth: 2,
          title: 'SMA 20',
        });
      }
      indicatorSeriesRefs.current.sma20.setData(sma20Data);
    }

    if (indicators.sma50 && chartRef.current) {
      const sma50Data = calculateSMA(candles, 50);
      if (!indicatorSeriesRefs.current.sma50) {
        indicatorSeriesRefs.current.sma50 = chartRef.current.addLineSeries({
          color: '#FF9800',
          lineWidth: 2,
          title: 'SMA 50',
        });
      }
      indicatorSeriesRefs.current.sma50.setData(sma50Data);
    }

    if (indicators.ema12 && chartRef.current) {
      const ema12Data = calculateEMA(candles, 12);
      if (!indicatorSeriesRefs.current.ema12) {
        indicatorSeriesRefs.current.ema12 = chartRef.current.addLineSeries({
          color: '#4CAF50',
          lineWidth: 1,
          title: 'EMA 12',
        });
      }
      indicatorSeriesRefs.current.ema12.setData(ema12Data);
    }

    if (indicators.ema26 && chartRef.current) {
      const ema26Data = calculateEMA(candles, 26);
      if (!indicatorSeriesRefs.current.ema26) {
        indicatorSeriesRefs.current.ema26 = chartRef.current.addLineSeries({
          color: '#F44336',
          lineWidth: 1,
          title: 'EMA 26',
        });
      }
      indicatorSeriesRefs.current.ema26.setData(ema26Data);
    }

    setTimeout(() => {
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }, 100);
  }, [candles, indicators]);

  // Fetch data when parameters change
  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!accountSetId || !currentSet) return;

    console.log('🔗 Setting up WebSocket connection for premium updates...');
    console.log(`📊 Account: ${accountSetId}, Symbols: ${currentSet.futureSymbol} vs ${currentSet.spotSymbol}`);
    
    connectWS(accountSetId);
    subscribeToPremium(accountSetId, currentSet.futureSymbol, currentSet.spotSymbol);

    const handlePremiumUpdate = (data) => {
      console.log('📨 Premium update received:', data);
      if (data.accountSetId === accountSetId) {
        handleRealtimeUpdate(data);
      }
    };

    const unsubscribe = onMessage('premium_update', handlePremiumUpdate);

    return () => {
      unsubscribe?.();
    };
  }, [accountSetId, currentSet, handleRealtimeUpdate]);

  // Periodic refresh to ensure chart stays synchronized
  useEffect(() => {
    if (!accountSetId) return;

    // Refresh historical data every 5 minutes to ensure consistency
    refreshIntervalRef.current = setInterval(() => {
      console.log('🔄 Periodic historical data refresh...');
      fetchCandles();
    }, 5 * 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [accountSetId, fetchCandles]);

  // Chart controls
  const handleZoomIn = () => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    if (visibleRange) {
      const center = (visibleRange.from + visibleRange.to) / 2;
      const newRange = (visibleRange.to - visibleRange.from) * 0.8;
      timeScale.setVisibleRange({
        from: center - newRange / 2,
        to: center + newRange / 2
      });
    }
  };

  const handleZoomOut = () => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    if (visibleRange) {
      const center = (visibleRange.from + visibleRange.to) / 2;
      const newRange = (visibleRange.to - visibleRange.from) * 1.2;
      timeScale.setVisibleRange({
        from: center - newRange / 2,
        to: center + newRange / 2
      });
    }
  };

  const handleReset = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  const clearDrawings = () => {
    drawings.forEach(drawing => {
      if (drawing.priceLine && drawing.priceLine.remove) {
        drawing.priceLine.remove();
      }
    });
    setDrawings([]);
    setDrawingMode(null);
    setIsDrawing(false);
    setDrawingPoints([]);
  };

  const toggleIndicator = (indicatorName) => {
    setIndicators(prev => {
      const newIndicators = { ...prev, [indicatorName]: !prev[indicatorName] };
      
      if (!newIndicators[indicatorName] && indicatorSeriesRefs.current[indicatorName]) {
        if (chartRef.current) {
          chartRef.current.removeSeries(indicatorSeriesRefs.current[indicatorName]);
        }
        delete indicatorSeriesRefs.current[indicatorName];
      }
      
      return newIndicators;
    });
  };

  const exportChartData = () => {
    if (!candles.length) return;
    
    const dataStr = JSON.stringify(candles, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `premium-chart-data-${company}-${tf}m-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      background: '#1a1a1a',
      borderRadius: '8px',
      border: '1px solid #333',
      overflow: 'hidden',
      position: 'relative',
      ...(isFullscreen ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        borderRadius: 0
      } : {})
    }}>
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}
      </style>
      <div style={{
        background: '#2a2a2a',
        padding: '12px 16px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TrendingUp size={20} color="#3b82f6" />
          <span style={{ color: '#fff', fontWeight: '600' }}>Premium Chart Pro</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: getStatusInfo().color,
              boxShadow: currentCandleHighlight ? `0 0 10px ${getStatusInfo().color}` : 'none',
              transition: 'box-shadow 0.3s ease',
              animation: connectionStatus === 'live' ? 'pulse 2s infinite' : 'none'
            }} />
            <span style={{ color: getStatusInfo().color, fontSize: '12px', fontWeight: '500' }}>
              {getStatusInfo().icon} {getStatusInfo().label}
              {lastUpdate && (
                <span style={{ color: '#888', marginLeft: '4px' }}>
                  • {new Date(lastUpdate).toLocaleTimeString()}
                </span>
              )}
            </span>
          </div>
          
          {/* Current Price Display */}
          {currentPrice && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              background: 'rgba(59, 130, 246, 0.1)',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <span style={{ color: '#3b82f6', fontSize: '12px', fontWeight: '500' }}>
                Current: {currentPrice.toFixed(5)}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {timeframes.map(timeframeOption => (
            <button
              key={timeframeOption.value}
              onClick={() => setTf(timeframeOption.value)}
              style={{
                padding: '6px 12px',
                background: tf === timeframeOption.value ? '#3b82f6' : '#333',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {timeframeOption.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setDrawingMode(drawingMode === 'horizontal' ? null : 'horizontal')}
            style={{
              padding: '8px',
              background: drawingMode === 'horizontal' ? '#3b82f6' : '#333',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer'
            }}
            title="Horizontal Line"
          >
            <Minus size={16} />
          </button>

          <button
            onClick={() => setDrawingMode(drawingMode === 'trendline' ? null : 'trendline')}
            style={{
              padding: '8px',
              background: drawingMode === 'trendline' ? '#FF9800' : '#333',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer'
            }}
            title="Trend Line"
          >
            <TrendingDown size={16} />
          </button>

          <button
            onClick={() => setShowVolume(!showVolume)}
            style={{
              padding: '8px',
              background: showVolume ? '#4CAF50' : '#333',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer'
            }}
            title="Toggle Volume"
          >
            <Volume2 size={16} />
          </button>

          <button
            onClick={exportChartData}
            style={{
              padding: '8px',
              background: '#333',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer'
            }}
            title="Export Data"
          >
            <Download size={16} />
          </button>
          
          <button onClick={handleZoomIn} style={{ padding: '8px', background: '#333', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }} title="Zoom In">
            <ZoomIn size={16} />
          </button>
          
          <button onClick={handleZoomOut} style={{ padding: '8px', background: '#333', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }} title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          
          <button onClick={handleReset} style={{ padding: '8px', background: '#333', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }} title="Reset View">
            <RotateCcw size={16} />
          </button>

          {drawings.length > 0 && (
            <button onClick={clearDrawings} style={{ padding: '8px', background: '#ef4444', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }} title="Clear Drawings">
              Clear
            </button>
          )}
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{ padding: '8px', background: '#333', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
            title="Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div style={{
        background: '#222',
        padding: '8px 16px',
        borderBottom: '1px solid #333',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <span style={{ color: '#888', fontSize: '12px', fontWeight: '500' }}>Indicators:</span>
        
        {Object.entries({
          sma20: 'SMA 20',
          sma50: 'SMA 50', 
          ema12: 'EMA 12',
          ema26: 'EMA 26'
        }).map(([key, label]) => (
          <button
            key={key}
            onClick={() => toggleIndicator(key)}
            style={{
              padding: '4px 8px',
              background: indicators[key] ? '#3b82f6' : '#333',
              border: 'none',
              borderRadius: '3px',
              color: '#fff',
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {indicators[key] ? <Eye size={12} /> : <EyeOff size={12} />}
            <span style={{ marginLeft: '4px' }}>{label}</span>
          </button>
        ))}
      </div>

      {drawingMode && (
        <div style={{
          background: drawingMode === 'trendline' ? '#FF9800' : '#3b82f6',
          padding: '8px 16px',
          color: '#fff',
          fontSize: '12px',
          borderBottom: '1px solid #444',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Activity size={14} />
          {drawingMode === 'horizontal' && 'Click on any candle to draw a support/resistance line'}
          {drawingMode === 'trendline' && (
            isDrawing ? 
            'Click to place the second point of your trend line' : 
            'Click to start drawing a trend line (2 points required)'
          )}
          {isDrawing && drawingPoints.length > 0 && (
            <button 
              onClick={() => { setDrawingMode(null); setIsDrawing(false); setDrawingPoints([]); }}
              style={{ 
                background: '#ef4444', 
                border: 'none', 
                borderRadius: '3px', 
                color: '#fff', 
                padding: '2px 6px',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <div style={{
        background: '#222',
        padding: '8px 16px',
        fontSize: '12px',
        color: '#888',
        borderBottom: '1px solid #333',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <span>📊 Candles: <span style={{ color: '#fff' }}>{candles.length}</span></span>
          <span>⏱️ Timeframe: <span style={{ color: '#fff' }}>{tf}m</span></span>
          <span>🏢 Company: <span style={{ color: '#fff' }}>{company}</span></span>
          <span>🔗 Account: <span style={{ color: '#fff' }}>#{accountSetId?.slice(-6)}</span></span>
          {drawings.length > 0 && (
            <span>✏️ Drawings: <span style={{ color: '#fff' }}>{drawings.length}</span></span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {latestCandle && (
            <>
              <span>💹 Latest: <span style={{ 
                color: latestCandle.close >= latestCandle.open ? '#26a69a' : '#ef5350'
              }}>
                {latestCandle.close?.toFixed(5)}
              </span></span>
              {currentCandleHighlight && (
                <span style={{ color: '#00ff88', fontWeight: 'bold' }}>🔴 LIVE</span>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#ef4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
          zIndex: 100
        }}>
          {error}
          <br />
          <button onClick={fetchCandles} style={{
            marginTop: '8px',
            padding: '8px 16px',
            background: '#fff',
            color: '#ef4444',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontSize: '16px'
        }}>
          Loading chart data...
        </div>
      )}

      <div
        ref={chartContainer}
        style={{
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 180px)' : (showVolume ? '500px' : '400px'),
          display: loading ? 'none' : 'block',
          position: 'relative',
          background: '#1a1a1a'
        }}
      />

      {currentCandleHighlight && (
        <div style={{
          position: 'absolute',
          top: isFullscreen ? '200px' : '160px',
          right: '20px',
          background: 'rgba(0, 255, 136, 0.1)',
          border: '2px solid #00ff88',
          borderRadius: '8px',
          padding: '8px 12px',
          color: '#00ff88',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 100,
          animation: 'pulse 1s ease-in-out',
          pointerEvents: 'none'
        }}>
          📈 LIVE UPDATE
        </div>
      )}

      {!loading && !error && candles.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#888'
        }}>
          <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <h3 style={{ color: '#fff', margin: '0 0 8px 0' }}>No Data Available</h3>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Premium data collection may not be active.<br />
            Please ensure symbols are locked and trading is active.
          </p>
        </div>
      )}
    </div>
  );
}