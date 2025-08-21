import React, { useEffect, useState, useCallback } from 'react';
import { fetchSymbols, fetchQuote } from '../services/api';
import symbolsCache from '../services/symbolsCache';
import { connectWS, onMessage, subscribeToQuotes } from '../services/wsService';
import { TrendingUp, TrendingDown, Zap, Target, Activity, BarChart3, Search, Settings, AlertTriangle } from 'lucide-react';
import API from '../services/api';
import './TradeExecution.css';

export default function TradeExecution({
  accountSet: propAccountSet, // Account set from props (if any)
}) {
  const [broker1Symbols, setBroker1Symbols] = useState([]);
  const [broker2Symbols, setBroker2Symbols] = useState([]);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [selectedBroker1, setSelectedBroker1] = useState('');
  const [selectedBroker2, setSelectedBroker2] = useState('');
  const [direction, setDirection] = useState('Sell');
  const [volume, setVolume] = useState('');
  const [targetPremium, setTargetPremium] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [takeProfitMode, setTakeProfitMode] = useState('None'); // 'None', 'Premium', 'Amount'
  const [scalping, setScalping] = useState(false);

  // Latency monitoring state
  const [latencyData, setLatencyData] = useState({
    broker1: {
      lastOrderLatency: null,
      avgOrderLatency: null,
      lastQuoteLatency: null,
      avgQuoteLatency: null
    },
    broker2: {
      lastOrderLatency: null,
      avgOrderLatency: null,
      lastQuoteLatency: null,
      avgQuoteLatency: null
    }
  });

  // ─── Premium Spread state ───
  const [futureQuote, setFutureQuote] = useState(null);
  const [spotQuote, setSpotQuote] = useState(null);
  const [buyPremium, setBuyPremium] = useState(0);
  const [sellPremium, setSellPremium] = useState(0);

  // Removed latency monitoring - not needed

  // ─── STANDALONE MODE: Load account sets if not provided ───
  const [accountSets, setAccountSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  
  // Use prop accountSet if provided, otherwise use selected from state
  const accountSet = propAccountSet || accountSets.find(s => s._id === selectedSetId);

  // ✅ FIX: Clear stale data when account set changes
  useEffect(() => {
    if (selectedSetId || propAccountSet) {
      console.log('🧹 TradeExecution: Clearing stale quote data for account set change');
      setFutureQuote(null);
      setSpotQuote(null);
      setBuyPremium(0);
      setSellPremium(0);
    }
  }, [selectedSetId, propAccountSet?.id]);

  // ✅ FIXED: Auto-select symbols and clear state when account set changes
  useEffect(() => {
    console.log('🎯 TradeExecution: Account set symbol auto-selection triggered:', { 
      accountSetId: accountSet?.id,
      accountSetName: accountSet?.name,
      symbolsLocked: accountSet?.symbolsLocked,
      futureSymbol: accountSet?.futureSymbol,
      spotSymbol: accountSet?.spotSymbol
    });
    
    // ✅ Clear all state when account set changes
    setFutureQuote(null);
    setSpotQuote(null);
    setBuyPremium(0);
    setSellPremium(0);
    setError('');
    
    if (accountSet && accountSet.symbolsLocked && accountSet.futureSymbol && accountSet.spotSymbol) {
      console.log('✅ TradeExecution: Auto-selecting locked symbols:', { 
        future: accountSet.futureSymbol, 
        spot: accountSet.spotSymbol 
      });
      setSelectedBroker1(accountSet.futureSymbol);
      setSelectedBroker2(accountSet.spotSymbol);
    } else {
      console.log('🔓 TradeExecution: Account set has no locked symbols, clearing selections');
      setSelectedBroker1('');
      setSelectedBroker2('');
    }
  }, [accountSet?.id, accountSet?.name, accountSet?.symbolsLocked, accountSet?.futureSymbol, accountSet?.spotSymbol]);

  // Extract brokers from account set with position-based access
  const brokers = accountSet?.brokers || [];
  
  // ✅ SIMPLE: Use position-based broker selection
  const broker1 = brokers.find(b => b.position === 1) || brokers[0] || {};
  const broker2 = brokers.find(b => b.position === 2) || brokers[1] || {};

  // ✅ DEBUG: Log the actual broker data
  console.log('🔍 SIMPLE DEBUG - Raw broker data:', {
    accountSetName: accountSet?.name,
    totalBrokers: brokers.length,
    broker1Raw: broker1,
    broker2Raw: broker2
  });

  // Determine which terminal each "broker slot" corresponds to:
  const broker1Terminal = broker1.terminal || '';
  const broker2Terminal = broker2.terminal || '';

  // ✅ SIMPLE FIX: Use the correct ID field 
  const broker1Id = broker1.id || broker1._id || null;
  const broker2Id = broker2.id || broker2._id || null;

  // ✅ LOG: Show what IDs we're actually using
  console.log('🔍 BROKER IDs EXTRACTED:', {
    broker1Id,
    broker2Id,
    broker1Terminal,
    broker2Terminal
  });

  const broker1Label = `Broker 1 (${broker1Terminal})`;
  const broker2Label = `Broker 2 (${broker2Terminal})`;

  // Fetch latency data for brokers
  const fetchLatencyData = useCallback(async () => {
    if (!broker1Id || !broker2Id) return;

    try {
      const [broker1Response, broker2Response] = await Promise.all([
        API.get(`/trading/latency/${broker1Id}`),
        API.get(`/trading/latency/${broker2Id}`)
      ]);

      setLatencyData({
        broker1: {
          lastOrderLatency: broker1Response.data.data?.orderSend?.current || null,
          avgOrderLatency: broker1Response.data.data?.orderSend?.average || null,
          lastQuoteLatency: broker1Response.data.data?.quotePing?.current || null,
          avgQuoteLatency: broker1Response.data.data?.quotePing?.average || null
        },
        broker2: {
          lastOrderLatency: broker2Response.data.data?.orderSend?.current || null,
          avgOrderLatency: broker2Response.data.data?.orderSend?.average || null,
          lastQuoteLatency: broker2Response.data.data?.quotePing?.current || null,
          avgQuoteLatency: broker2Response.data.data?.quotePing?.average || null
        }
      });
    } catch (err) {
      console.log('Failed to fetch latency data:', err.message);
    }
  }, [broker1Id, broker2Id]);

  // Load latency data when account set changes
  useEffect(() => {
    if (accountSet && broker1Id && broker2Id) {
      fetchLatencyData();
      
      // Refresh latency data every 30 seconds
      const interval = setInterval(fetchLatencyData, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchLatencyData, accountSet, broker1Id, broker2Id]);

  // ─── Smart Symbol Detection ──────────────────────────────
  const handleSmartSymbolRefresh = useCallback(async (typedSymbol, symbolsList, brokerId, terminal) => {
    if (typedSymbol.length > 2) {
      try {
        console.log('🔍 TradeExecution: Smart symbol search triggered for:', typedSymbol);
        
        // Find the broker object to search
        const brokerToSearch = brokers.find(b => (b.id || b._id) === brokerId);
        if (brokerToSearch) {
          // Use the new smart search functionality
          const result = await symbolsCache.searchAndUpdateSymbol(typedSymbol, symbolsList, brokerToSearch);
          
          if (result.symbols.length > 0) {
            if (brokerId === broker1Id) {
              setBroker1Symbols(result.symbols);
            } else if (brokerId === broker2Id) {
              setBroker2Symbols(result.symbols);
            }
            
            if (result.found) {
              console.log(`✅ TradeExecution: Symbol "${typedSymbol}" found after search for ${terminal}`);
            } else {
              console.log(`⚠️ TradeExecution: Symbol "${typedSymbol}" not found, but cache updated for ${terminal}`);
            }
          }
        }
      } catch (err) {
        console.error('❌ Smart symbol search failed:', err);
      }
    }
  }, [broker1Id, broker2Id, brokers]);

  // Load account sets if component is rendered standalone
  useEffect(() => {
    if (!propAccountSet) {
      API.get('/account-sets')
        .then(r => {
          const accountSetsData = r.data.data || r.data;
          if (Array.isArray(accountSetsData)) {
            setAccountSets(accountSetsData);
            if (accountSetsData.length) {
              const firstSet = accountSetsData[0];
              setSelectedSetId(firstSet._id || firstSet.id);
            }
          } else {
            setAccountSets([]);
          }
        })
        .catch(err => {
          setAccountSets([]);
        });
    } else {
      // If account set is provided via props and has locked symbols, auto-select them
      if (propAccountSet.futureSymbol && propAccountSet.spotSymbol) {
        setSelectedBroker1(propAccountSet.futureSymbol);
        setSelectedBroker2(propAccountSet.spotSymbol);
      }
    }
  }, [propAccountSet]);

  // ─── Premium calculation ───
  useEffect(() => {
    if (futureQuote && spotQuote) {
      setBuyPremium((futureQuote.ask || 0) - (spotQuote.bid || 0));
      setSellPremium((futureQuote.bid || 0) - (spotQuote.ask || 0));
    } else {
      setBuyPremium(0);
      setSellPremium(0);
    }
  }, [futureQuote, spotQuote]);

  // Removed latency monitoring - not needed

  // Removed latency monitoring - not needed

  // Removed test latency - not needed

  // ─── Order execution functionality ───
  const executeOrder = useCallback(async (orderType) => {
    // Clear any previous errors
    setError('');
    
    // Validation
    if (!selectedBroker1 || !selectedBroker2 || !volume) {
      setError('Please select symbols and enter volume');
      return;
    }

    if (!accountSet?.id && !accountSet?._id) {
      setError('Please select an account set');
      return;
    }

    // Set executing state immediately
    setExecuting(true);
    
    try {
      console.log('🚀 Executing order:', {
        orderType,
        accountSetId: accountSet.id || accountSet._id,
        direction,
        volume: parseFloat(volume),
        selectedBroker1,
        selectedBroker2
      });

      // Calculate take profit based on mode
      let takeProfitValue = null;
      if (takeProfitMode === 'None' || !takeProfit) {
        takeProfitValue = null;
      } else if (takeProfitMode === 'Premium') {
        // For premium mode, store as premium value
        takeProfitValue = parseFloat(takeProfit);
      } else if (takeProfitMode === 'Amount') {
        // For amount mode, store as dollar amount
        takeProfitValue = parseFloat(takeProfit);
      }

      const orderData = {
        accountSetId: accountSet.id || accountSet._id,
        direction,
        volume: parseFloat(volume),
        takeProfit: takeProfitValue,
        takeProfitMode, // Send the mode to server
        stopLoss: null,
        scalpingMode: scalping,
        comment: 'FluxNetwork Trade'
      };

      let response;
      let successMessage;

      if (orderType === 'current') {
        console.log('📤 Sending execute-current request...');
        response = await API.post('/trading/execute-current', orderData);
        successMessage = 'Trade executed successfully at current premium!';
      } else if (orderType === 'target') {
        if (!targetPremium) {
          throw new Error('Please enter target premium');
        }
        
        orderData.targetPremium = parseFloat(targetPremium);
        console.log('📤 Sending execute-target request...');
        response = await API.post('/trading/execute-target', orderData);
        successMessage = 'Pending order created successfully!';
      }
      
      console.log('✅ Order execution response:', response.data);
      
      // Clear form on success
      setVolume('');
      setTargetPremium('');
      setTakeProfit('');
      
      // Show success message
      alert(successMessage);
      
      // If it's a current trade execution and successful, suggest user check active trades
      if (orderType === 'current' && response.data?.success) {
        console.log('✅ Trade created, should now appear in active trades');
      }
      
    } catch (err) {
      console.error('❌ Order execution error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Order execution failed';
      setError(errorMessage);
      
    } finally {
      // Always turn off executing, regardless of success or failure
      setExecuting(false);
      
      // Refresh latency data after order execution
      try {
        await fetchLatencyData();
      } catch (latencyErr) {
        console.log('Failed to refresh latency after order:', latencyErr.message);
      }
    }
  }, [selectedBroker1, selectedBroker2, volume, direction, targetPremium, takeProfit, scalping, accountSet, fetchLatencyData]);

  // ✅ OPTIMIZED: Fetch quotes using batch API for better performance
  const fetchQuotes = useCallback(async () => {
    if (!selectedBroker1 || !selectedBroker2 || !broker1Id || !broker2Id) {
      setFutureQuote(null);
      setSpotQuote(null);
      return;
    }
    
    // Validate: Only fetch quotes for symbols that exist in our loaded lists
    const broker1HasSymbol = broker1Symbols.includes(selectedBroker1);
    const broker2HasSymbol = broker2Symbols.includes(selectedBroker2);
    
    if (!broker1HasSymbol || !broker2HasSymbol) {
      return;
    }
    
    try {
      // Use batch API for efficient quote fetching (database-first approach)
      const { fetchMultipleQuotes } = await import('../services/api');
      const batchRes = await fetchMultipleQuotes([
        { symbol: selectedBroker1, terminal: broker1Terminal, brokerId: broker1Id },
        { symbol: selectedBroker2, terminal: broker2Terminal, brokerId: broker2Id }
      ]);

      if (batchRes.data.success) {
        const [futureResult, spotResult] = batchRes.data.data;
        
        setFutureQuote(futureResult.success ? futureResult.data : null);
        setSpotQuote(spotResult.success ? spotResult.data : null);

        // Log optimization info for trade execution
        if (futureResult.success && spotResult.success) {
          const futureAge = futureResult.data.age || 0;
          const spotAge = spotResult.data.age || 0;
          console.log(`🎯 Trade quotes: Future ${futureResult.data.cached ? 'cached' : 'fresh'} (${futureAge}ms), Spot ${spotResult.data.cached ? 'cached' : 'fresh'} (${spotAge}ms)`);
        }
      } else {
        // Fallback to individual requests
        try {
          const futureRes = await fetchQuote(selectedBroker1, broker1Terminal, broker1Id);
          setFutureQuote(futureRes.data.data);
        } catch (err) {
          setFutureQuote(null);
        }

        try {
          const spotRes = await fetchQuote(selectedBroker2, broker2Terminal, broker2Id);
          setSpotQuote(spotRes.data.data);
        } catch (err) {
          setSpotQuote(null);
        }
      }
    } catch (err) {
      console.error('❌ Trade quotes fetch error:', err);
      setFutureQuote(null);
      setSpotQuote(null);
    }
  }, [selectedBroker1, selectedBroker2, broker1Id, broker2Id, broker1Terminal, broker2Terminal, broker1Symbols, broker2Symbols]);

  // ✅ ADD: Live quotes via WebSocket
  useEffect(() => {
    // Ensure we have an account set and selected symbols
    if (!accountSet?._id || !selectedBroker1 || !selectedBroker2) {
      return;
    }

    // This handler will be called by the wsService when a new quote arrives
    const handleQuoteUpdate = (data) => {
      // Check if the update is for the symbols we are currently watching
      if (data.futureSymbol === selectedBroker1 && data.futureQuote) {
        setFutureQuote(data.futureQuote);
      }
      if (data.spotSymbol === selectedBroker2 && data.spotQuote) {
        setSpotQuote(data.spotQuote);
      }
    };

    // ✅ FIX: Only connect and subscribe if symbols are locked
    if (accountSet && accountSet.symbolsLocked && selectedBroker1 && selectedBroker2) {
      console.log('📡 TradeExecution: Subscribing to quotes for LOCKED symbols:', { 
        selectedBroker1, selectedBroker2 
      });
      connectWS(accountSet._id);
      subscribeToQuotes(accountSet._id, selectedBroker1, selectedBroker2, handleQuoteUpdate);
    } else {
      console.log('🚫 TradeExecution: Skipping quote subscription - symbols not locked:', { 
        symbolsLocked: accountSet?.symbolsLocked,
        selectedBroker1,
        selectedBroker2
      });
    }

    // The 'onMessage' function returns an unsubscribe function for cleanup
    const unsubscribe = onMessage('quote_update', handleQuoteUpdate);

    // This cleanup function will be called when the component unmounts or dependencies change
    return () => {
      unsubscribe();
    };
  }, [selectedBroker1, selectedBroker2, accountSet?._id, accountSet?.symbolsLocked]);

  // ✅ OPTIMIZED: Load symbols using broker symbols cache
  useEffect(() => {
    console.log('🔄 TradeExecution: useEffect symbols loading triggered:', {
      accountSetId: accountSet?._id,
      accountSetName: accountSet?.name,
      brokersLength: brokers.length
    });

    // Clear existing symbols when account set changes
    setBroker1Symbols([]);
    setBroker2Symbols([]);

    // Skip if no account set or brokers
    if (!accountSet || !brokers.length || brokers.length < 2) {
      console.log('⚠️ TradeExecution: Skipping symbol loading - insufficient data');
      setLoadingSymbols(false);
      return;
    }

    const loadSymbolsOptimized = async () => {
      setLoadingSymbols(true);
      setError('');
      
      console.log('🚀 TradeExecution: Starting optimized symbol loading for:', {
        accountSetId: accountSet._id,
        accountSetName: accountSet.name
      });

      try {
        // Use the optimized symbols cache service
        const result = await symbolsCache.getSymbolsForAccountSet(accountSet);
        
        if (result.success) {
          setBroker1Symbols(result.broker1Symbols);
          setBroker2Symbols(result.broker2Symbols);
          console.log(`✅ TradeExecution: Loaded symbols via cache - Broker1: ${result.broker1Symbols.length}, Broker2: ${result.broker2Symbols.length}`);
          
          if (!result.broker1Symbols.length && !result.broker2Symbols.length) {
            setError('No symbols found in cache. Symbols may still be loading in the background.');
          }
        } else {
          console.error('❌ TradeExecution: Failed to load symbols:', result.error);
          setError(result.error || 'Failed to load symbols');
        }
      } catch (err) {
        console.error('❌ TradeExecution: Symbol loading error:', err);
        setError(`Failed to load symbols: ${err.message}`);
      } finally {
        setLoadingSymbols(false);
        console.log('🏁 TradeExecution: Optimized symbol loading complete');
      }
    };
    
    loadSymbolsOptimized();

    return () => {
      console.log('🧹 TradeExecution: Cleaning up symbol loading effect');
    };
  }, [accountSet?._id, accountSet?.name]);

  const onBroker1Change = async (e) => {
    const v = e.target.value;
    setSelectedBroker1(v);
    await handleSmartSymbolRefresh(v, broker1Symbols, broker1Id, broker1Terminal);
    
    // Auto-select for broker 2 if there's a match
    const base = v.endsWith('.') ? v.slice(0, -1) : v;
    if (broker2Symbols.includes(base)) {
      setSelectedBroker2(base);
    } else if (broker2Symbols.includes(v)) {
      setSelectedBroker2(v);
    }
  };

  const onBroker2Change = async (e) => {
    const v = e.target.value;
    setSelectedBroker2(v);
    await handleSmartSymbolRefresh(v, broker2Symbols, broker2Id, broker2Terminal);
  };

  return (
    <div className="trade-exec-page">
      {/* Header - Enhanced with professional styling */}
      <div className="cockpit-header">
        <div className="header-main">
          <div className="header-icon">
            <BarChart3 style={{ width: '32px', height: '32px' }} />
          </div>
          <div className="header-content">
            <h1>Trade Execution Cockpit</h1>
            <p className="subtitle">Professional cross-broker trading interface</p>
          </div>
        </div>
        
        <div className="broker-status">
          <div className="status-item">
            <div className={`status-indicator ${loadingSymbols ? 'loading' : (broker1Symbols.length > 0 ? 'online' : 'offline')}`}></div>
            <span>{broker1Label}</span>
            <div className="symbol-count">
              {loadingSymbols ? '...' : `${broker1Symbols.length} symbols`}
            </div>
          </div>
          <div className="status-item">
            <div className={`status-indicator ${loadingSymbols ? 'loading' : (broker2Symbols.length > 0 ? 'online' : 'offline')}`}></div>
            <span>{broker2Label}</span>
            <div className="symbol-count">
              {loadingSymbols ? '...' : `${broker2Symbols.length} symbols`}
            </div>
          </div>
          <div className="status-item premium-spread">
            <div className="status-indicator online"></div>
            <span>Premium Spread</span>
            <div className="spread-values">
              <div style={{ color: '#4ade80' }}>Buy: {buyPremium.toFixed(2)}</div>
              <div style={{ color: '#f87171' }}>Sell: {sellPremium.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Grid - Professional Layout */}
      <div className="trading-grid">
        {/* Account Set Selector - As a trading panel */}
        {!propAccountSet && accountSets.length > 0 && (
          <div className="trading-panel account-panel">
            <div className="panel-header">
              <Settings style={{ width: '20px', height: '20px' }} />
              <h2>Account Configuration</h2>
            </div>
            <div className="account-selector-content">
              <div className="param-group">
                <label>Trading Account Set</label>
                <select 
                  value={selectedSetId} 
                  onChange={e => {
                    console.log('🔄 TradeExecution: Account set changed via dropdown:', e.target.value);
                    setSelectedSetId(e.target.value);
                    // Auto-selection will be handled by the useEffect hook
                  }}
                  className="param-input"
                >
                  {accountSets.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
        
        {/* Symbol Selection Panel with Smart Detection */}
        <div className="trading-panel symbol-panel">
          <div className="panel-header">
            <Search style={{ width: '20px', height: '20px' }} />
            <h2>Symbol Selection</h2>
          </div>
          <div className="symbol-inputs">
            <div className="input-group">
              <label>
                {broker1Label} ({loadingSymbols ? 'loading...' : `${broker1Symbols.length} symbols`})
                {broker1Symbols.length === 0 && !loadingSymbols && (
                  <span style={{ color: '#f87171', marginLeft: '5px' }}>❌ No symbols</span>
                )}
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  list="broker1SymbolsList"
                  placeholder={loadingSymbols ? "Loading symbols..." : `Search ${broker1Terminal} symbols...`}
                  value={selectedBroker1}
                  onChange={onBroker1Change}
                  className="symbol-input"
                  disabled={loadingSymbols}
                />
                <Search className="input-icon" />
              </div>
            </div>
            
            <div className="input-group">
              <label>
                {broker2Label} ({loadingSymbols ? 'loading...' : `${broker2Symbols.length} symbols`})
                {broker2Symbols.length === 0 && !loadingSymbols && (
                  <span style={{ color: '#f87171', marginLeft: '5px' }}>❌ No symbols</span>
                )}
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  list="broker2SymbolsList"
                  placeholder={loadingSymbols ? "Loading symbols..." : `Search ${broker2Terminal} symbols...`}
                  value={selectedBroker2}
                  onChange={onBroker2Change}
                  className="symbol-input"
                  disabled={loadingSymbols}
                />
                <Search className="input-icon" />
              </div>
            </div>
          </div>

          <datalist id="broker1SymbolsList">
            {broker1Symbols.map((sym, i) => (
              <option key={`broker1-${i}`} value={typeof sym === 'object' ? (sym.currency || sym.symbol || sym.name || JSON.stringify(sym)) : sym} />
            ))}
          </datalist>
          <datalist id="broker2SymbolsList">
            {broker2Symbols.map((sym, i) => (
              <option key={`broker2-${i}`} value={typeof sym === 'object' ? (sym.currency || sym.symbol || sym.name || JSON.stringify(sym)) : sym} />
            ))}
          </datalist>
        </div>

        {/* Direction Panel */}
        <div className="trading-panel direction-panel">
          <div className="panel-header">
            <Activity style={{ width: '20px', height: '20px' }} />
            <h2>Trade Direction</h2>
          </div>
          <div className="direction-buttons">
            <button
              className={`direction-btn buy-btn ${direction === 'Buy' ? 'active' : ''}`}
              onClick={() => setDirection('Buy')}
            >
              <TrendingUp style={{ width: '24px', height: '24px' }} />
              <span>BUY</span>
              <div className="btn-highlight"></div>
            </button>
            <button
              className={`direction-btn sell-btn ${direction === 'Sell' ? 'active' : ''}`}
              onClick={() => setDirection('Sell')}
            >
              <TrendingDown style={{ width: '24px', height: '24px' }} />
              <span>SELL</span>
              <div className="btn-highlight"></div>
            </button>
          </div>
        </div>

        {/* Parameters Panel */}
        <div className="trading-panel parameters-panel">
          <div className="panel-header">
            <Target style={{ width: '20px', height: '20px' }} />
            <h2>Trade Parameters</h2>
          </div>
          
          {/* Prominent Warning Banner */}
          <div className="parameters-warning-banner">
            <AlertTriangle className="warning-icon" />
            <div className="warning-text">
              Always check minimum lot size on your broker terminal before placing order to avoid execution failures
            </div>
          </div>
          
          <div className="parameter-inputs">
            <div className="param-group">
              <label>Volume</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={volume}
                onChange={e => setVolume(e.target.value)}
                className="param-input"
              />
            </div>
            <div className="param-group">
              <label>Target Premium</label>
              <input
                type="number"
                step="0.00001"
                placeholder="0.00000"
                value={targetPremium}
                onChange={e => setTargetPremium(e.target.value)}
                className="param-input"
              />
            </div>
            <div className="param-group">
              <label>Take Profit</label>
              
              {/* Take Profit Mode Selection */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="takeProfitMode" 
                    value="None" 
                    checked={takeProfitMode === 'None'}
                    onChange={e => {
                      setTakeProfitMode(e.target.value);
                      if (e.target.value === 'None') setTakeProfit('');
                    }}
                  />
                  None
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="takeProfitMode" 
                    value="Premium" 
                    checked={takeProfitMode === 'Premium'}
                    onChange={e => setTakeProfitMode(e.target.value)}
                  />
                  TP (In Premium Value)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="takeProfitMode" 
                    value="Amount" 
                    checked={takeProfitMode === 'Amount'}
                    onChange={e => setTakeProfitMode(e.target.value)}
                  />
                  TP In $(Amount)
                </label>
              </div>
              
              {/* Take Profit Input - only show when not 'None' */}
              {takeProfitMode !== 'None' && (
                <input
                  type="number"
                  step={takeProfitMode === 'Premium' ? '0.00001' : '0.01'}
                  placeholder={takeProfitMode === 'Premium' ? '0.00000' : '0.00'}
                  value={takeProfit}
                  onChange={e => setTakeProfit(e.target.value)}
                  className="param-input"
                />
              )}
              
              {/* Helper text */}
              {takeProfitMode === 'Premium' && (
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  {direction === 'Buy' ? 'Maps to Sell Premium when order executes' : 'Maps to Buy Premium when order executes'}
                </div>
              )}
              {takeProfitMode === 'Amount' && (
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  Take profit when total profit reaches this $ amount
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="trading-panel actions-panel">
          <div className="panel-header">
            <Zap style={{ width: '20px', height: '20px' }} />
            <h2>Trade Actions</h2>
          </div>
          <div className="action-buttons">
            <button 
              className="action-btn current-premium"
              onClick={() => executeOrder('current')}
              disabled={executing || loadingSymbols || !selectedBroker1 || !selectedBroker2 || !volume || !accountSet}
              title={!accountSet ? 'Please select an account set first' : (!selectedBroker1 || !selectedBroker2) ? 'Please select symbols for both brokers' : !volume ? 'Please enter volume' : 'Execute trade at current premium'}
            >
              <div className="btn-content">{executing ? 'Executing...' : 'Execute at Current Premium'}</div>
              <div className="btn-glow"></div>
            </button>
            <button 
              className="action-btn target-premium"
              onClick={() => executeOrder('target')}
              disabled={executing || loadingSymbols || !selectedBroker1 || !selectedBroker2 || !volume || !targetPremium || !accountSet}
              title={!accountSet ? 'Please select an account set first' : (!selectedBroker1 || !selectedBroker2) ? 'Please select symbols for both brokers' : !volume ? 'Please enter volume' : !targetPremium ? 'Please enter target premium' : 'Create pending order at target premium'}
            >
              <div className="btn-content">{executing ? 'Creating Order...' : 'Execute at Target Premium'}</div>
              <div className="btn-glow"></div>
            </button>
          </div>
          
          <div className="scalping-control">
            <label className="scalping-toggle">
              <input
                type="checkbox"
                checked={scalping}
                onChange={e => setScalping(e.target.checked)}
              />
              <div className="toggle-slider">
                <div className="toggle-thumb"></div>
              </div>
              Scalping Mode
            </label>
          </div>
        </div>

      </div>

      {loadingSymbols && (
        <div className="loading-container" style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '20px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 1000
        }}>
          <div className="loading-spinner" style={{
            width: '20px',
            height: '20px',
            border: '2px solid #444',
            borderTop: '2px solid #4ade80',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div className="loading-text">Loading symbols...</div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .status-indicator.loading {
          background-color: #fbbf24 !important;
          animation: pulse 1.5s ease-in-out infinite;
        }
        .status-indicator.offline {
          background-color: #f87171 !important;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {error && (
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error-text">{error}</div>
        </div>
      )}

      {/* Latency Monitoring Panel */}
      <div className="trading-panel latency-panel" style={{ marginTop: '20px' }}>
        <div className="panel-header">
          <h2>Latency Monitoring</h2>
        </div>
        <div className="latency-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Broker 1 Latency */}
          <div className="latency-broker" style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontWeight: 'bold', backgroundColor: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>{broker1Label}</h3>
            <div className="latency-metrics">
              <div className="latency-item" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: '#555' }}>Last Order:</label>
                <span className="latency-value" style={{ fontWeight: 'bold', color: latencyData.broker1.lastOrderLatency ? (latencyData.broker1.lastOrderLatency > 1000 ? 'red' : 'green') : '#999' }}>
                  {latencyData.broker1.lastOrderLatency ? `${latencyData.broker1.lastOrderLatency}ms` : 'N/A'}
                </span>
              </div>
              <div className="latency-item" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: '#555' }}>Order Latency Avg(Day):</label>
                <span className="latency-value" style={{ fontWeight: 'bold', color: latencyData.broker1.avgOrderLatency ? (latencyData.broker1.avgOrderLatency > 1000 ? 'red' : 'green') : '#999' }}>
                  {latencyData.broker1.avgOrderLatency ? `${latencyData.broker1.avgOrderLatency}ms` : 'N/A'}
                </span>
              </div>
              <div className="latency-item" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: '#555' }}>Quote Ping:</label>
                <span className="latency-value" style={{ fontWeight: 'bold', color: latencyData.broker1.lastQuoteLatency ? (latencyData.broker1.lastQuoteLatency > 500 ? 'red' : 'green') : '#999' }}>
                  {latencyData.broker1.lastQuoteLatency ? `${latencyData.broker1.lastQuoteLatency}ms` : 'N/A'}
                </span>
              </div>
              <div className="latency-item" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: '#555' }}>Quote Latency Avg(Day):</label>
                <span className="latency-value" style={{ fontWeight: 'bold', color: latencyData.broker1.avgQuoteLatency ? (latencyData.broker1.avgQuoteLatency > 500 ? 'red' : 'green') : '#999' }}>
                  {latencyData.broker1.avgQuoteLatency ? `${latencyData.broker1.avgQuoteLatency}ms` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Broker 2 Latency */}
          <div className="latency-broker" style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontWeight: 'bold', backgroundColor: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>{broker2Label}</h3>
            <div className="latency-metrics">
              <div className="latency-item" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: '#555' }}>Last Order:</label>
                <span className="latency-value" style={{ fontWeight: 'bold', color: latencyData.broker2.lastOrderLatency ? (latencyData.broker2.lastOrderLatency > 1000 ? 'red' : 'green') : '#999' }}>
                  {latencyData.broker2.lastOrderLatency ? `${latencyData.broker2.lastOrderLatency}ms` : 'N/A'}
                </span>
              </div>
              <div className="latency-item" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: '#555' }}>Order Latency Avg(Day):</label>
                <span className="latency-value" style={{ fontWeight: 'bold', color: latencyData.broker2.avgOrderLatency ? (latencyData.broker2.avgOrderLatency > 1000 ? 'red' : 'green') : '#999' }}>
                  {latencyData.broker2.avgOrderLatency ? `${latencyData.broker2.avgOrderLatency}ms` : 'N/A'}
                </span>
              </div>
              <div className="latency-item" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: '#555' }}>Quote Ping:</label>
                <span className="latency-value" style={{ fontWeight: 'bold', color: latencyData.broker2.lastQuoteLatency ? (latencyData.broker2.lastQuoteLatency > 500 ? 'red' : 'green') : '#999' }}>
                  {latencyData.broker2.lastQuoteLatency ? `${latencyData.broker2.lastQuoteLatency}ms` : 'N/A'}
                </span>
              </div>
              <div className="latency-item" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: '#555' }}>Quote Latency Avg(Day):</label>
                <span className="latency-value" style={{ fontWeight: 'bold', color: latencyData.broker2.avgQuoteLatency ? (latencyData.broker2.avgQuoteLatency > 500 ? 'red' : 'green') : '#999' }}>
                  {latencyData.broker2.avgQuoteLatency ? `${latencyData.broker2.avgQuoteLatency}ms` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: '#666' }}>
          Latency updates every 30 seconds. Lower is better for execution speed.
        </div>
      </div>
      
    </div>
  );
}