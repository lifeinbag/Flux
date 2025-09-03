import React, { useState, useEffect, useRef, createContext, useCallback } from 'react';
import API from '../services/api';
import { fetchSymbols, fetchQuote } from '../services/api';
import symbolsCache from '../services/symbolsCache';
import SellPremiumChart from '../components/SellPremiumChart';
import { connectWS, onMessage, subscribeToQuotes, subscribeToOpenOrders, isWSConnected, getWSStatus, clearQuoteSubscriptions, wsManager, createBrokerKey, isQuoteFresh, onBalanceBatch, onQuoteBatch } from '../services/wsService';
import { TrendingUp, DollarSign, BarChart3, Activity, AlertTriangle, Lock, Unlock, Clock } from 'lucide-react';
// API Status Monitor removed
import DollarRain from '../components/DollarRain';
import './Dashboard.css';

export const DashboardContext = createContext();

// Helper functions for chart
function getCompanyNameFromSet(currentSet) {
  // PRIORITY 1: Use premiumTableName directly (most reliable)
  if (currentSet.premiumTableName) {
    const withoutPrefix = currentSet.premiumTableName.replace(/^premium_/, '');
    const parts = withoutPrefix.split('_');
    const symbolPatterns = ['vs', 'gcq', 'xau', 'eur', 'usd', 'gbp', 'jpy', 'cad', 'aud', 'nzd', 'chf', 'oil', 'btc', 'eth'];
    let symbolStartIndex = -1;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].toLowerCase();
      if (symbolPatterns.some(pattern => part.includes(pattern))) {
        symbolStartIndex = i;
        break;
      }
    }
    
    if (symbolStartIndex > 0) {
      const brokerParts = parts.slice(0, symbolStartIndex);
      const companyName = brokerParts.join('_');
      return companyName;
    } else {
      const estimatedBrokerCount = Math.min(2, Math.floor(parts.length / 2));
      const brokerParts = parts.slice(0, estimatedBrokerCount);
      const companyName = brokerParts.join('_');
      return companyName;
    }
  }
  
  if (currentSet.companyMappings) {
    const mappings = currentSet.companyMappings;
    let companies = [];
    if (typeof mappings === 'object' && !Array.isArray(mappings)) {
      companies = Object.values(mappings);
    } else if (Array.isArray(mappings)) {
      companies = mappings;
    }
    
    if (companies.length >= 2) {
      const normalizedCompanies = companies.map(company => 
        String(company).toLowerCase().replace(/[^a-z0-9]/g, '')
      ).filter(company => company.length > 0);
      
      if (normalizedCompanies.length >= 2) {
        const companyName = normalizedCompanies.join('_');
        return companyName;
      }
    }
  }
  
  const brokers = currentSet.brokers || [];
  if (brokers.length >= 2) {
    const extractedCompanies = brokers.map(broker => {
      if (broker.companyName) {
        return broker.companyName;
      }
      if (broker.server) {
        return extractCompanyFromServer(broker.server);
      }
      if (broker.brokerName) {
        return broker.brokerName;
      }
      return null;
    }).filter(company => company && company.length > 0);
    
    if (extractedCompanies.length >= 2) {
      const normalizedCompanies = extractedCompanies.map(company =>
        String(company).toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      const companyName = normalizedCompanies.join('_');
      return companyName;
    }
  }
  
  if (currentSet.name) {
    const normalized = String(currentSet.name)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
    
    if (normalized.length > 0) {
      return normalized;
    }
  }
  
  const fallback = generateFallbackName(currentSet);
  return fallback;
}

function extractCompanyFromServer(server) {
  if (!server || typeof server !== 'string') return null;
  
  const parts = String(server).split('.');
  if (parts.length === 0) return null;
  
  let company = parts[0];
  const commonPatterns = [
    /demo$/i, /real$/i, /live$/i, /server$/i, 
    /mt[45]$/i, /-\d+$/i, /\d+$/
  ];
  
  for (const pattern of commonPatterns) {
    company = company.replace(pattern, '');
  }
  
  if (company.length < 3 && parts.length > 1) {
    company = parts[1].split('-')[0];
  }
  
  company = company.replace(/[^a-z0-9]/gi, '').toLowerCase();
  
  return company.length > 0 ? company : null;
}

function generateFallbackName(currentSet) {
  const parts = [];
  
  const brokers = currentSet.brokers || [];
  if (brokers.length > 0) {
    brokers.forEach(broker => {
      if (broker.terminal) {
        parts.push(broker.terminal.toLowerCase());
      }
    });
  }
  
  if (currentSet._id || currentSet.id) {
    const id = (currentSet._id || currentSet.id).toString();
    parts.push(id.substring(0, 8));
  }
  
  if (parts.length === 0) {
    parts.push('set', Date.now().toString().slice(-6));
  }
  
  return parts.join('_');
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [tradingStatus, setTradingStatus] = useState(null);
  const [accountSets, setAccountSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [showDollarRain, setShowDollarRain] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState(15);
  
  const currentSet = accountSets.find(s => s._id === selectedSetId) || { brokers: [] };
  const [brokerBalances, setBrokerBalances] = useState({});
  const [tradeMapping, setTradeMapping] = useState([]);
  const [activeTrades, setActiveTrades] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const [futureQuote, setFutureQuote] = useState(null);
  const [spotQuote, setSpotQuote] = useState(null);
  const [buyPremium, setBuyPremium] = useState(0);
  const [sellPremium, setSellPremium] = useState(0);
  const [lockedFutureQuote, setLockedFutureQuote] = useState(null);
  const [lockedSpotQuote, setLockedSpotQuote] = useState(null);
  const [broker1Symbols, setBroker1Symbols] = useState([]);
  const [broker2Symbols, setBroker2Symbols] = useState([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [futureSymbol, setFutureSymbol] = useState('');
  const [spotSymbol, setSpotSymbol] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const latestRef = useRef({});
  const [wsConnected, setWsConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [dataAvailable, setDataAvailable] = useState(true);
  const lastBalanceUpdate = useRef(Date.now());
  const wsStatusCheckInterval = useRef(null);
  const brokerLookupCache = useRef(new Map());
  const balanceUpdateDebounce = useRef(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  
  const brokers = currentSet.brokers || [];
  const sortedBrokers = [...brokers].sort((a, b) => (a.position || 0) - (b.position || 0));
  const broker1 = sortedBrokers.find(b => b.position === 1) || {};
  const broker2 = sortedBrokers.find(b => b.position === 2) || {};
  const broker1Term = broker1.terminal || '';
  const broker2Term = broker2.terminal || '';
  
  // Enhanced error handling for missing broker data
  const broker1Valid = broker1.server && broker1.accountNumber && broker1.position && broker1.terminal;
  const broker2Valid = broker2.server && broker2.accountNumber && broker2.position && broker2.terminal;
  
  // ✅ FIX 4: Use unified broker key creation
  const key1 = broker1Valid ? createBrokerKey(broker1) : '';
  const key2 = broker2Valid ? createBrokerKey(broker2) : '';
    
  const broker1Id = broker1.id || broker1._id;
  const broker2Id = broker2.id || broker2._id;
  
  // ✅ FIX 4: Enhanced balance data with standardized keys and freshness check
  const defaultBalance = { balance: 0, equity: 0, profit: 0, leverage: 0, lastUpdate: 0 };
  const b1 = key1 ? (brokerBalances[key1] || defaultBalance) : defaultBalance;
  const b2 = key2 ? (brokerBalances[key2] || defaultBalance) : defaultBalance;
  
  // Check balance freshness (within 5 minutes)
  const now = Date.now();
  const b1Fresh = b1.lastUpdate && (now - b1.lastUpdate) < 300000;
  const b2Fresh = b2.lastUpdate && (now - b2.lastUpdate) < 300000;
  
  // ✅ FIX 4: Enhanced debug with freshness info
  console.log('🔍 Broker balance lookup debug:', {
    key1,
    key2,
    broker1Data: b1,
    broker2Data: b2,
    broker1Fresh: b1Fresh,
    broker2Fresh: b2Fresh,
    availableBalanceKeys: Object.keys(brokerBalances),
    balanceDataEntries: Object.entries(brokerBalances),
    wsManagerConnected: wsManager?.socket?.readyState === WebSocket.OPEN
  });
  
  // ✅ FLUX-NETWORK SPECIFIC: Calculate broker-specific profits from REAL-TIME data
  // Use active trades from WebSocket (these have real-time P&L) instead of database data
  const broker1FluxProfit = activeTrades.reduce((sum, t) => {
    // Only use actual broker1Profit field - no misleading fallbacks
    const profit = parseFloat(t.broker1Profit) || 0;
    return sum + profit;
  }, 0);
  
  const broker2FluxProfit = activeTrades.reduce((sum, t) => {
    // Only use actual broker2Profit field - no misleading fallbacks
    const profit = parseFloat(t.broker2Profit) || 0;
    return sum + profit;
  }, 0);
  
  // Also try to get profits from WebSocket open orders data if active trades don't have profit
  const wsOpenOrdersProfit = activeTrades.reduce((sum, t) => sum + (parseFloat(t.totalProfit) || 0), 0);
  
  const totalFluxNetworkProfit = broker1FluxProfit + broker2FluxProfit || wsOpenOrdersProfit;
  const overallFluxProfit = closedTrades.reduce((sum, t) => sum + (parseFloat(t.totalProfit) || 0), 0);
  
  // 🔍 DEBUG: Log active trades data to check profit fields
  console.log('🔍 FluxNetwork P&L Debug:', {
    activeTradesCount: activeTrades.length,
    sampleTrade: activeTrades[0] || null,
    sampleTradeFields: activeTrades[0] ? Object.keys(activeTrades[0]) : [],
    broker1FluxProfit,
    broker2FluxProfit,
    wsOpenOrdersProfit,
    totalFluxNetworkProfit,
    calculation: {
      fromBrokerProfits: broker1FluxProfit + broker2FluxProfit,
      fromTotalProfit: wsOpenOrdersProfit
    },
    tradesProfitFields: activeTrades.map(t => ({
      id: t.id || t.tradeId,
      broker1Profit: t.broker1Profit,
      broker2Profit: t.broker2Profit,
      currentProfit: t.currentProfit,
      profit: t.profit,
      totalProfit: t.totalProfit
    }))
  });
  const totalOpenOrders = activeTrades.length;
  const totalOpenLots = activeTrades.reduce((sum, t) => sum + (parseFloat(t.broker1Volume) || 0), 0);
  
  // Calculate Avg. Premium = (Sum of [Opening Premium × Lot Size]) / (Sum of Lot Sizes)
  const totalWeightedPremium = activeTrades.reduce((sum, t) => {
    const premium = parseFloat(t.executionPremium) || 0;
    const lotSize = parseFloat(t.broker1Volume) || 0;
    return sum + (premium * lotSize);
  }, 0);
  const avgPremium = totalOpenLots > 0 ? totalWeightedPremium / totalOpenLots : 0;
  const timeframeOptions = [
    { value: 1, label: '1M' },
    { value: 5, label: '5M' },
    { value: 15, label: '15M' },
    { value: 30, label: '30M' },
    { value: 60, label: '1H' },
    { value: 240, label: '4H' },
    { value: 1440, label: '1D' }
  ];

  const handleSmartSymbolRefresh = useCallback(
    async (typedSymbol, symbolsList, brokerId, terminal) => {
      if (typedSymbol.length > 2) {
        try {
          console.log('🔍 Dashboard: Smart symbol search triggered for:', typedSymbol);
          
          // Find the broker object to search
          const brokerToSearch = currentSet.brokers?.find(b => (b.id || b._id) === brokerId);
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
                console.log(`✅ Dashboard: Symbol "${typedSymbol}" found after search for ${terminal}`);
              } else {
                console.log(`⚠️ Dashboard: Symbol "${typedSymbol}" not found, but cache updated for ${terminal}`);
              }
            }
          }
        } catch (err) {
          console.error('❌ Smart symbol search failed:', err);
        }
      }
    },
    [broker1Id, broker2Id, currentSet.brokers]
  );

  const loadActiveTradesData = useCallback(async () => {
    if (!selectedSetId) return;
    
    try {
      const res = await API.get(`/trading/active-trades?accountSetId=${selectedSetId}`);
      if (res.data.success) {
        const trades = res.data.trades || [];
        console.log('📊 Dashboard: Active trades loaded:', trades);
        const tradesWithProfits = trades.map(trade => ({
          ...trade,
          broker1Profit: trade.broker1Profit || 0,
          broker2Profit: trade.broker2Profit || 0,
          totalProfit: (trade.broker1Profit || 0) + (trade.broker2Profit || 0)
        }));
        console.log('📊 Dashboard: Trades with profits calculated:', tradesWithProfits);
        setActiveTrades(tradesWithProfits);
      }
    } catch (err) {
      console.error('Failed to load active trades:', err);
      setActiveTrades([]);
    }
  }, [selectedSetId]);

  const loadClosedTradesData = useCallback(async () => {
    if (!selectedSetId) return;
    
    try {
      const res = await API.get(`/trading/closed-trades?accountSetId=${selectedSetId}`);
      if (res.data.success) {
        const trades = res.data.trades || [];
        console.log('💰 Dashboard: Closed trades loaded:', trades);
        console.log('💰 Dashboard: Closed trades sample profit fields:', trades[0] ? {
          totalProfit: trades[0].totalProfit,
          broker1Profit: trades[0].broker1Profit,
          broker2Profit: trades[0].broker2Profit
        } : 'No trades');
        setClosedTrades(trades);
      }
    } catch (err) {
      console.error('Failed to load closed trades:', err);
      setClosedTrades([]);
    }
  }, [selectedSetId]);

  useEffect(() => {
    if (selectedSetId) {
      loadActiveTradesData();
      loadClosedTradesData();
      
      // 🔧 FORCE BALANCE REFRESH: Clear balance data when switching account sets
      // This ensures fresh balance data for all brokers in the new account set
      console.log('🔄 Account set changed, clearing balance cache for fresh data');
      setBrokerBalances({});
    }
  }, [selectedSetId, loadActiveTradesData, loadClosedTradesData]);

  useEffect(() => {
    // Show dollar rain every time user visits dashboard (fresh login, tab switch, etc.)
    setShowDollarRain(true);
    
    // Stop dollar rain after 5 seconds
    const dollarTimeout = setTimeout(() => {
      setShowDollarRain(false);
    }, 5000);
    
    // Cleanup timeout
    return () => clearTimeout(dollarTimeout);
  }, []); // Empty dependency array so it runs on every component mount

  useEffect(() => {
    
    API.get('/users/me')
      .then(r => setUser(r.data))
      .catch(() => {
        // Generate a fallback referral code or use default
        const fallbackCode = process.env.REACT_APP_DEFAULT_REFERRAL_CODE || 
                            Math.random().toString(36).substring(2, 10).toUpperCase();
        setUser({ email: 'User', referralCode: fallbackCode });
      });
    
    API.get('/trading/status')
      .then(r => setTradingStatus(r.data.available ? 'Trading service available.' : 'Trading service unavailable.'))
      .catch(() => setTradingStatus('Trading service unavailable.'));
    
    API.get('/account-sets')
      .then(r => {
        const accountSetsData = r.data.data || r.data;
        if (Array.isArray(accountSetsData)) {
          setAccountSets(accountSetsData);
          if (accountSetsData.length) {
            const firstSet = accountSetsData[0];
            setSelectedSetId(firstSet._id || firstSet.id);
            if (firstSet.symbolsLocked && firstSet.futureSymbol && firstSet.spotSymbol) {
              setFutureSymbol(firstSet.futureSymbol);
              setSpotSymbol(firstSet.spotSymbol);
            }
          }
        } else {
          setAccountSets([]);
        }
      })
      .catch(err => {
        setAccountSets([]);
      });
      
    // Cleanup function
    return () => {
      if (wsStatusCheckInterval.current) {
        clearInterval(wsStatusCheckInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    const set = accountSets.find(s => s._id === selectedSetId);
    if (set && set.symbolsLocked && set.futureSymbol && set.spotSymbol) {
      setFutureSymbol(set.futureSymbol);
      setSpotSymbol(set.spotSymbol);
    } else if (!currentSet.symbolsLocked) {
      setFutureSymbol('');
      setSpotSymbol('');
    }
  }, [selectedSetId, accountSets, currentSet.symbolsLocked]);
  
  useEffect(() => {
    if (selectedSetId) {
      console.log('🔄 Account set changed, clearing stale data and quote subscriptions');
      
      // Clear stale data
      setFutureQuote(null);
      setSpotQuote(null);
      setBuyPremium(0);
      setSellPremium(0);
      setLockedFutureQuote(null);
      setLockedSpotQuote(null);
      setBrokerBalances({});
      
      // Clear old quote subscriptions to prevent stale data
      clearQuoteSubscriptions();
    }
  }, [selectedSetId]);

  // ✅ OPTIMIZED: Fetch locked quotes using batch API
  useEffect(() => {
    if (!currentSet.symbolsLocked) return;
    
    const fetchLockedQuotes = async () => {
      try {
        const { fetchMultipleQuotes } = await import('../services/api');
        const batchRes = await fetchMultipleQuotes([
          { symbol: currentSet.futureSymbol, terminal: broker1Term, brokerId: broker1Id },
          { symbol: currentSet.spotSymbol, terminal: broker2Term, brokerId: broker2Id }
        ]);

        if (batchRes.data.success) {
          const [futureResult, spotResult] = batchRes.data.data;
          setLockedFutureQuote(futureResult.success ? futureResult.data : null);
          setLockedSpotQuote(spotResult.success ? spotResult.data : null);
        } else {
          // Fallback to individual requests
          fetchQuote(currentSet.futureSymbol, broker1Term, broker1Id)
            .then(res => setLockedFutureQuote(res.data.data))
            .catch(() => setLockedFutureQuote(null));
          fetchQuote(currentSet.spotSymbol, broker2Term, broker2Id)
            .then(res => setLockedSpotQuote(res.data.data))
            .catch(() => setLockedSpotQuote(null));
        }
      } catch (err) {
        console.error('❌ Locked quotes fetch error:', err);
        setLockedFutureQuote(null);
        setLockedSpotQuote(null);
      }
    };

    fetchLockedQuotes();
  }, [
    currentSet.symbolsLocked,
    currentSet.futureSymbol,
    currentSet.spotSymbol,
    broker1Term,
    broker2Term,
    broker1Id,
    broker2Id
  ]);

  // ✅ FIX 7: Enhanced batch handlers (moved outside useEffect to fix React Hooks rule)
  const handleBalanceBatch = useCallback((balanceUpdates) => {
    console.log('📊 Processing batched balance updates:', Object.keys(balanceUpdates).length);
    
    const processedUpdates = {};
    
    Object.entries(balanceUpdates).forEach(([key, data]) => {
      const brokerId = data.brokerId || data.data?.brokerId;
      const balanceData = data.data || data;
      
      if (!brokerId || !currentSet.brokers?.length || !selectedSetId) {
        return;
      }
      
      // ✅ FIX 4: Use standardized broker lookup
      const broker = currentSet.brokers?.find(x => 
        (x.id === brokerId) || (x._id === brokerId)
      );
      
      if (!broker) {
        console.log('⚠ Skipping balance update: broker not found in current account set', { 
          brokerId, 
          accountSetId: selectedSetId
        });
        return;
      }
      
      // ✅ FIX 4: Use unified broker key creation
      const brokerKey = createBrokerKey(broker);
      if (brokerKey) {
        processedUpdates[brokerKey] = {
          balance: parseFloat(balanceData.balance) || 0,
          equity: parseFloat(balanceData.equity) || 0,
          profit: parseFloat(balanceData.profit) || 0,
          leverage: parseFloat(balanceData.leverage) || 1,
          lastUpdate: Date.now()
        };
      }
    });
    
    if (Object.keys(processedUpdates).length > 0) {
      setBrokerBalances(prev => ({ ...prev, ...processedUpdates }));
      lastBalanceUpdate.current = Date.now();
      setWsConnected(true);
      setDataAvailable(true);
      console.log('✅ Updated', Object.keys(processedUpdates).length, 'broker balances');
    }
  }, [currentSet.brokers, selectedSetId]);

  const handleQuoteBatch = useCallback((quoteUpdates) => {
    console.log('📈 Processing batched quote updates:', Object.keys(quoteUpdates).length);
    
    Object.values(quoteUpdates).forEach(data => {
      // ✅ FIX 3: Validate quote freshness
      const futureValid = isQuoteFresh(data.futureQuote);
      const spotValid = isQuoteFresh(data.spotQuote);
      
      if (!futureValid || !spotValid) {
        console.warn('⚠️ Received stale quotes in batch:', {
          futureAge: data.futureQuote ? Date.now() - new Date(data.futureQuote.timestamp) : 'no quote',
          spotAge: data.spotQuote ? Date.now() - new Date(data.spotQuote.timestamp) : 'no quote'
        });
      }
      
      // Process the quote update with existing logic - need to call handleQuoteUpdate
      // But since handleQuoteUpdate is defined inside useEffect, we'll process directly here
      // ✅ FIX 3: Enhanced quote validation
      const futureValidLocal = data.futureQuoteFresh !== undefined ? data.futureQuoteFresh : isQuoteFresh(data.futureQuote);
      const spotValidLocal = data.spotQuoteFresh !== undefined ? data.spotQuoteFresh : isQuoteFresh(data.spotQuote);
      
      console.log('🔒 Symbols locked:', currentSet.symbolsLocked);
      console.log('🎯 Expected symbols:', { 
        future: currentSet.symbolsLocked ? currentSet.futureSymbol : futureSymbol,
        spot: currentSet.symbolsLocked ? currentSet.spotSymbol : spotSymbol
      });
      console.log('✅ Quote freshness:', { futureValidLocal, spotValidLocal });
      
      // Update quotes for locked symbols
      if (currentSet.symbolsLocked) {
        console.log('🔒 Processing locked symbols update');
        if (data.futureSymbol === currentSet.futureSymbol && data.futureQuote) {
          console.log('✅ Updating future quote for locked symbols:', data.futureQuote);
          setFutureQuote(data.futureQuote);
          setLockedFutureQuote(data.futureQuote);
        }
        
        if (data.spotSymbol === currentSet.spotSymbol) {
          if (data.spotQuote) {
            console.log('✅ Updating spot quote for locked symbols:', data.spotQuote);
            setSpotQuote(data.spotQuote);
            setLockedSpotQuote(data.spotQuote);
          }
        }
      } else {
        console.log('🔓 Processing unlocked symbols update');
        // Update quotes for unlocked symbols
        if (data.futureSymbol === futureSymbol && data.futureQuote) {
          console.log('✅ Updating future quote for unlocked symbols:', data.futureQuote);
          setFutureQuote(data.futureQuote);
        }
        if (data.spotSymbol === spotSymbol) {
          if (data.spotQuote) {
            console.log('✅ Updating spot quote for unlocked symbols:', data.spotQuote);
            setSpotQuote(data.spotQuote);
          }
        }
      }
    });
  }, [currentSet.symbolsLocked, currentSet.futureSymbol, currentSet.spotSymbol, futureSymbol, spotSymbol]);

  // ✅ FIXED WebSocket useEffect with proper handlers
  useEffect(() => {
    if (!selectedSetId) {
      console.log('🚫 Skipping WebSocket setup - missing selectedSetId');
      return;
    }
    
    if (!currentSet.brokers || currentSet.brokers.length === 0) {
      console.log('🚫 Skipping WebSocket setup - no brokers available yet');
      return;
    }

    console.log('🔗 Setting up WebSocket connection:', {
      selectedSetId,
      symbolsLocked: currentSet.symbolsLocked,
      futureSymbol: currentSet.symbolsLocked ? currentSet.futureSymbol : futureSymbol,
      spotSymbol: currentSet.symbolsLocked ? currentSet.spotSymbol : spotSymbol
    });

    const handleConnectionConfirmed = (data) => {
      console.log('✅ WebSocket connection confirmed:', data);
      setWsConnected(true);
      setWsStatus('connected');
    };

    const handleSubscriptionConfirmed = (data) => {
      console.log('✅ Subscription confirmed:', data);
      setWsConnected(true);
    };

    // Helper function to fetch latest quote when WebSocket data is null
    const fetchLatestQuote = async (symbol, type) => {
      try {
        // Find the appropriate broker for this symbol
        let brokerId, terminal;
        if (type === 'spot') {
          const broker = brokers.find(b => b.position === 2) || brokers[1];
          brokerId = broker?.id;
          terminal = broker?.terminal;
        } else {
          const broker = brokers.find(b => b.position === 1) || brokers[0];
          brokerId = broker?.id;
          terminal = broker?.terminal;
        }
        
        if (brokerId && terminal) {
          const response = await API.get(`/trading/quote/${symbol}`, {
            params: { terminal, id: brokerId }
          });
          
          if (response.data.success && response.data.data) {
            const quote = {
              bid: parseFloat(response.data.data.bid),
              ask: parseFloat(response.data.data.ask),
              symbol: symbol,
              timestamp: response.data.data.timestamp || new Date().toISOString()
            };
            
            if (type === 'spot') {
              console.log('✅ Fetched latest spot quote from cache:', quote);
              setSpotQuote(quote);
              if (currentSet.symbolsLocked) setLockedSpotQuote(quote);
            } else {
              console.log('✅ Fetched latest future quote from cache:', quote);
              setFutureQuote(quote);
              if (currentSet.symbolsLocked) setLockedFutureQuote(quote);
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to fetch latest quote for', symbol, ':', error.message);
      }
    };

    const handleQuoteUpdate = (data) => {
      console.log('📈 Optimized quote update received:', data);
      
      // ✅ Log cache optimization info
      if (data.futureQuote?.source || data.spotQuote?.source) {
        const futureAge = data.futureQuote?.age || 0;
        const spotAge = data.spotQuote?.age || 0;
        console.log(`📊 WebSocket quotes: Future ${data.futureQuote?.source || 'unknown'} (${futureAge}ms), Spot ${data.spotQuote?.source || 'unknown'} (${spotAge}ms)`);
      }
      
      // ✅ FIX 3: Enhanced quote validation
      const futureValid = data.futureQuoteFresh !== undefined ? data.futureQuoteFresh : isQuoteFresh(data.futureQuote);
      const spotValid = data.spotQuoteFresh !== undefined ? data.spotQuoteFresh : isQuoteFresh(data.spotQuote);
      
      console.log('🔒 Symbols locked:', currentSet.symbolsLocked);
      console.log('🎯 Expected symbols:', { 
        future: currentSet.symbolsLocked ? currentSet.futureSymbol : futureSymbol,
        spot: currentSet.symbolsLocked ? currentSet.spotSymbol : spotSymbol
      });
      console.log('✅ Quote freshness:', { futureValid, spotValid });
      
      // Update quotes for locked symbols
      if (currentSet.symbolsLocked) {
        console.log('🔒 Processing locked symbols update');
        if (data.futureSymbol === currentSet.futureSymbol && data.futureQuote) {
          console.log('✅ Updating future quote for locked symbols:', data.futureQuote);
          setFutureQuote(data.futureQuote);
          setLockedFutureQuote(data.futureQuote);
        } else {
          console.log('❌ Future symbol mismatch or missing quote:', {
            expected: currentSet.futureSymbol,
            received: data.futureSymbol,
            hasQuote: !!data.futureQuote
          });
        }
        
        if (data.spotSymbol === currentSet.spotSymbol) {
          if (data.spotQuote) {
            console.log('✅ Updating spot quote for locked symbols:', data.spotQuote);
            setSpotQuote(data.spotQuote);
            setLockedSpotQuote(data.spotQuote);
          } else {
            console.log('⚠️ Spot quote is null, trying to fetch from cache for symbol:', data.spotSymbol);
            // Try to get the latest quote from cache/API
            fetchLatestQuote(data.spotSymbol, 'spot');
          }
        } else {
          console.log('❌ Spot symbol mismatch:', {
            expected: currentSet.spotSymbol,
            received: data.spotSymbol,
            hasQuote: !!data.spotQuote
          });
        }
      } else {
        console.log('🔓 Processing unlocked symbols update');
        // Update quotes for unlocked symbols
        if (data.futureSymbol === futureSymbol && data.futureQuote) {
          console.log('✅ Updating future quote for unlocked symbols:', data.futureQuote);
          setFutureQuote(data.futureQuote);
        }
        if (data.spotSymbol === spotSymbol) {
          if (data.spotQuote) {
            console.log('✅ Updating spot quote for unlocked symbols:', data.spotQuote);
            setSpotQuote(data.spotQuote);
          } else {
            console.log('⚠️ Spot quote is null, trying to fetch from cache for symbol:', data.spotSymbol);
            fetchLatestQuote(data.spotSymbol, 'spot');
          }
        }
      }
    };


    // Legacy individual balance handler for backward compatibility
    const handleBalanceUpdate = (data) => {
      const brokerId = data.brokerId || data.data?.brokerId;
      const balanceData = data.data || data;
      
      if (!brokerId || !currentSet.brokers?.length || !selectedSetId) {
        return;
      }
      
      const broker = currentSet.brokers?.find(x => 
        (x.id === brokerId) || (x._id === brokerId)
      );
      
      if (!broker) {
        return;
      }
      
      // ✅ FIX 4: Use unified broker key creation
      const brokerKey = createBrokerKey(broker);
      if (brokerKey) {
        setBrokerBalances(prev => ({ 
          ...prev, 
          [brokerKey]: {
            balance: parseFloat(balanceData.balance) || 0,
            equity: parseFloat(balanceData.equity) || 0,
            profit: parseFloat(balanceData.profit) || 0,
            leverage: parseFloat(balanceData.leverage) || 1,
            lastUpdate: Date.now()
          }
        }));
        lastBalanceUpdate.current = Date.now();
        setWsConnected(true);
        setDataAvailable(true);
        console.log('✅ Updated single balance for broker:', brokerKey);
      }
    };

    
    const handleError = (data) => {
      console.log('❌ WebSocket error received:', data);
      
      setErrorMsg(`⚠ ${data.message || 'Connection issue'}`);
      setTimeout(() => setErrorMsg(''), 5000);
    };
    
    const handleTradeMapping = (data) => {
      console.log('📋 Trade mapping received:', data);
      if (Array.isArray(data)) setTradeMapping(data);
    };

    const handleActiveTradesUpdate = (msg) => {
      const payload = msg?.data ?? msg;
      const accountSetId = payload?.accountSetId;
      const orders = Array.isArray(payload?.orders) ? payload.orders : [];

      console.log('📨 WebSocket: Open orders update received:', {
        accountSetId,
        selectedSetId,
        ordersCount: orders.length,
        orders: orders.map(o => ({ 
          ticket: o.ticket, 
          brokerId: o.brokerId, 
          brokerPosition: o.brokerPosition,
          profit: o.profit,
          symbol: o.symbol 
        }))
      });

      if (accountSetId !== selectedSetId) {
        console.log('⚠️ Ignoring orders update for different account set');
        return;
      }

      setActiveTrades(prev => {
        const byKey = new Map();
        for (const o of orders) {
          const keys = [];
          if (o.brokerId) keys.push(`${o.brokerId}:${o.ticket}`);
          if (o.brokerPosition != null) keys.push(`${o.brokerPosition}:${o.ticket}`);
          keys.push(String(o.ticket));
          keys.forEach(key => byKey.set(key, o));
        }

        return prev.map(t => {
          const o1Keys = [
            `${t.broker1Id}:${t.broker1Ticket}`,
            `1:${t.broker1Ticket}`,
            String(t.broker1Ticket)
          ];
          const o2Keys = [
            `${t.broker2Id}:${t.broker2Ticket}`,
            `2:${t.broker2Ticket}`,
            String(t.broker2Ticket)
          ];
          
          const o1 = o1Keys.map(key => byKey.get(key)).find(order => order);
          const o2 = o2Keys.map(key => byKey.get(key)).find(order => order);
          
          const p1 = Number(o1?.profit) || 0;
          const p2 = Number(o2?.profit) || 0;
          
          console.log(`💰 Dashboard: Updated profits for trade ${t.tradeId}: broker1=${p1}, broker2=${p2}, total=${p1 + p2}`);

          return { ...t, broker1Profit: p1, broker2Profit: p2, totalProfit: p1 + p2 };
        });
      });
    };

    // ✅ FIX 2 & FIX 7: Register both individual and batch handlers
    const unsubConnection = onMessage('connection', handleConnectionConfirmed);
    const unsubSubscription = onMessage('subscription_confirmed', handleSubscriptionConfirmed);
    const unsubQuote = onMessage('quote_update', handleQuoteUpdate);
    const unsubBal = onMessage('balance', handleBalanceUpdate);
    const unsubErr = onMessage('error', handleError);
    const unsubTrade = onMessage('trade_mapping', handleTradeMapping);
    const unsubActiveOrders = onMessage('open_orders_update', handleActiveTradesUpdate);
    const unsubApiError = onMessage('api_error', (data) => {
      console.log('🚨 API Error received:', data);
      // Handle API errors silently or show notification if needed
    });
    
    // ✅ FIX 7: Register batch handlers for performance
    const unsubBalanceBatch = onBalanceBatch(handleBalanceBatch);
    const unsubQuoteBatch = onQuoteBatch(handleQuoteBatch);

    // Connect to WebSocket
    connectWS(selectedSetId);
    
    // Subscribe to open orders for dashboard updates
    subscribeToOpenOrders(selectedSetId);
    
    // ✅ FIX: Only subscribe to quotes if symbols are LOCKED
    if (currentSet.symbolsLocked && currentSet.futureSymbol && currentSet.spotSymbol) {
      console.log('📡 Subscribing to quotes for LOCKED symbols:', { 
        futureSymbol: currentSet.futureSymbol, 
        spotSymbol: currentSet.spotSymbol 
      });
      subscribeToQuotes(selectedSetId, currentSet.futureSymbol, currentSet.spotSymbol, handleQuoteUpdate);
    } else {
      console.log('🚫 Skipping quote subscription - symbols not locked or missing:', { 
        symbolsLocked: currentSet.symbolsLocked,
        futureSymbol: currentSet.futureSymbol,
        spotSymbol: currentSet.spotSymbol
      });
    }

    // WebSocket status monitoring
    const statusCheck = setInterval(() => {
      const status = getWSStatus();
      setWsStatus(status);
      setWsConnected(isWSConnected());
      
      // Check if we've missed balance updates - don't disconnect, just mark data unavailable
      const timeSinceLastUpdate = Date.now() - lastBalanceUpdate.current;
      if (timeSinceLastUpdate > 60000) { // 60 seconds - increased from 30s
        setDataAvailable(false);
      } else if (timeSinceLastUpdate < 30000) {
        setDataAvailable(true);
      }
    }, 10000); // Reduced polling frequency to 10s

    wsStatusCheckInterval.current = statusCheck;
    
    return () => {
      console.log('🧹 Cleaning up WebSocket subscriptions');
      clearInterval(statusCheck);
      unsubConnection();
      unsubSubscription();
      unsubQuote();
      unsubApiError();
      unsubBal();
      unsubErr();
      unsubTrade();
      unsubActiveOrders();
      // ✅ FIX 7: Cleanup batch handlers
      unsubBalanceBatch();
      unsubQuoteBatch();
    };
  }, [selectedSetId, futureSymbol, spotSymbol, currentSet.symbolsLocked, currentSet.futureSymbol, currentSet.spotSymbol]);

  const handleSubmitSymbols = async () => {
    if (!futureSymbol || !spotSymbol) {
      setSubmitMessage('Please enter both Future and Spot symbols');
      setTimeout(() => setSubmitMessage(''), 3000);
      return;
    }

    setSubmitting(true);
    try {
      const response = await API.patch(`/account-sets/${selectedSetId}/symbols`, {
        futureSymbol,
        spotSymbol
      });
      
      if (response.data.success) {
        setSubmitMessage('Symbols locked and premium tracking started!');
        setAccountSets(prev => prev.map(set => 
          set._id === selectedSetId 
            ? { ...set, symbolsLocked: true, futureSymbol, spotSymbol, premiumTableName: response.data.tables?.premium }
            : set
        ));
      } else {
        setSubmitMessage(`Failed: ${response.data.error}`);
      }
    } catch (err) {
      setSubmitMessage('Failed to save symbols: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
      setTimeout(() => setSubmitMessage(''), 5000);
    }
  };

  const handleUnlockSymbols = async () => {
    try {
      const response = await API.patch(`/account-sets/${selectedSetId}/unlock-symbols`);
      
      if (response.data.success) {
        setSubmitMessage('Symbols unlocked for new selection');
        setAccountSets(prev => prev.map(set => 
          set._id === selectedSetId 
            ? { ...set, symbolsLocked: false, futureSymbol: '', spotSymbol: '', premiumTableName: null }
            : set
        ));
        setFutureSymbol('');
        setSpotSymbol('');
      }
    } catch (err) {
      setSubmitMessage(`Failed to unlock: ${err.response?.data?.error || err.message}`);
    }
  };

  // ✅ OPTIMIZED: Load symbols using broker symbols cache
  useEffect(() => {
    console.log('🔄 Dashboard: useEffect symbols loading triggered:', {
      selectedSetId,
      symbolsLocked: currentSet.symbolsLocked
    });

    // Clear symbols when account set changes or if symbols are locked
    setBroker1Symbols([]);
    setBroker2Symbols([]);

    if (!selectedSetId || currentSet.symbolsLocked) {
      console.log('⚠️ Dashboard: Skipping symbol loading - no set or symbols locked');
      setSymbolsLoading(false);
      return;
    }

    const loadSymbolsOptimized = async () => {
      setSymbolsLoading(true);
      setErrorMsg('');

      console.log('🚀 Dashboard: Starting optimized symbol loading for:', {
        selectedSetId,
        accountSetName: currentSet.name
      });

      try {
        // Use the optimized symbols cache service
        const result = await symbolsCache.getSymbolsForAccountSet(currentSet);
        
        if (result.success) {
          setBroker1Symbols(result.broker1Symbols);
          setBroker2Symbols(result.broker2Symbols);
          console.log(`✅ Dashboard: Loaded symbols via cache - Broker1: ${result.broker1Symbols.length}, Broker2: ${result.broker2Symbols.length}`);
          
          if (!result.broker1Symbols.length && !result.broker2Symbols.length) {
            setErrorMsg('No symbols found in cache. Symbols may still be loading in the background.');
          }
        } else {
          console.error('❌ Dashboard: Failed to load symbols:', result.error);
          setErrorMsg(result.error || 'Failed to load symbols');
        }
      } catch (err) {
        console.error('❌ Dashboard: Symbol loading error:', err);
        setErrorMsg(`Failed to load symbols: ${err.message}`);
      } finally {
        setSymbolsLoading(false);
        console.log('🏁 Dashboard: Optimized symbol loading complete');
      }
    };

    loadSymbolsOptimized();
  }, [selectedSetId, currentSet.symbolsLocked, currentSet.name]);

  // Premium calculation
  useEffect(() => {
    const activeQuotes = currentSet.symbolsLocked 
      ? { future: lockedFutureQuote || futureQuote, spot: lockedSpotQuote || spotQuote }
      : { future: futureQuote, spot: spotQuote };
    
    if (activeQuotes.future && activeQuotes.spot) {
      const newBuyPremium = (activeQuotes.future.ask || 0) - (activeQuotes.spot.bid || 0);
      const newSellPremium = (activeQuotes.future.bid || 0) - (activeQuotes.spot.ask || 0);
      
      setBuyPremium(newBuyPremium);
      setSellPremium(newSellPremium);
    } else {
      setBuyPremium(0);
      setSellPremium(0);
    }
  }, [futureQuote, spotQuote, lockedFutureQuote, lockedSpotQuote, currentSet.symbolsLocked]);

  // ✅ OPTIMIZED: Fetch quotes using batch API for better performance
  // Fetch trade session status
  const fetchSessionStatus = useCallback(async () => {
    if (!selectedSetId || !currentSet.symbolsLocked) {
      setSessionStatus(null);
      return;
    }

    try {
      const response = await API.get(`/trading/session-status/${selectedSetId}`);
      if (response.data.success) {
        setSessionStatus(response.data.data);
      }
    } catch (error) {
      console.error('❌ Failed to fetch session status:', error);
      setSessionStatus(null);
    }
  }, [selectedSetId, currentSet.symbolsLocked]);

  // Session status polling removed - using WebSocket real-time data instead

  const fetchQuotes = useCallback(async () => {
    if (!futureSymbol || !spotSymbol || !broker1Id || !broker2Id) {
      setFutureQuote(null);
      setSpotQuote(null);
      return;
    }

    try {
      // Use batch API for efficient quote fetching (database-first approach)
      const { fetchMultipleQuotes } = await import('../services/api');
      const batchRes = await fetchMultipleQuotes([
        { symbol: futureSymbol, terminal: broker1Term, brokerId: broker1Id },
        { symbol: spotSymbol, terminal: broker2Term, brokerId: broker2Id }
      ]);

      if (batchRes.data.success) {
        const [futureResult, spotResult] = batchRes.data.data;
        
        setFutureQuote(futureResult.success ? futureResult.data : null);
        setSpotQuote(spotResult.success ? spotResult.data : null);

        // Log optimization info
        if (futureResult.success && spotResult.success) {
          const futureAge = futureResult.data.age || 0;
          const spotAge = spotResult.data.age || 0;
          console.log(`📊 Quotes fetched: Future ${futureResult.data.cached ? 'cached' : 'fresh'} (${futureAge}ms), Spot ${spotResult.data.cached ? 'cached' : 'fresh'} (${spotAge}ms)`);
        }
      } else {
        // Fallback to individual requests
        console.warn('⚠️ Batch request failed, falling back to individual requests');
        
        try {
          const futureRes = await fetchQuote(futureSymbol, broker1Term, broker1Id);
          setFutureQuote(futureRes.data.data);
        } catch (err) {
          setFutureQuote(null);
        }

        try {
          const spotRes = await fetchQuote(spotSymbol, broker2Term, broker2Id);
          setSpotQuote(spotRes.data.data);
        } catch (err) {
          setSpotQuote(null);
        }
      }
    } catch (err) {
      console.error('❌ Quote fetch error:', err);
      setFutureQuote(null);
      setSpotQuote(null);
    }
  }, [
    futureSymbol,
    spotSymbol,
    broker1Id,
    broker2Id,
    broker1Term,
    broker2Term,
    broker1.position,
    broker2.position,
  ]);


  if (!user || tradingStatus === null) {
    return (
      <div className="modern-dashboard">
        <div className="dashboard-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div className="loading-text">
            Loading dashboard...
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={{
      accountSets, selectedSetId, setSelectedSetId, selectedTimeframe, setSelectedTimeframe, 
      tradeMapping
    }}>
      <DollarRain 
        show={showDollarRain} 
        duration={5000}
        onComplete={() => setShowDollarRain(false)}
      />
      <div className="modern-dashboard">
        {errorMsg && (
          <div className="error-alert">
            <AlertTriangle className="error-icon" />
            {errorMsg}
          </div>
        )}
        
        
        {selectedSetId && (
          <div style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 1000
          }}>
            {/* WebSocket Status */}
            <div style={{
              backgroundColor: wsConnected && dataAvailable ? '#22c55e' : wsConnected && !dataAvailable ? '#f59e0b' : '#ef4444',
              color: 'white',
              padding: '10px 15px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {wsConnected && dataAvailable ? '✅ WebSocket Connected' : 
               wsConnected && !dataAvailable ? '⚠️ Connected (Service Unavailable)' : 
               `🔌 WebSocket ${wsStatus}`}
            </div>
            
            {/* Trade Session Status */}
            {sessionStatus && (
              <div style={{
                backgroundColor: sessionStatus.overallStatus === 'open' ? '#22c55e' : 
                               sessionStatus.overallStatus === 'partial' ? '#f59e0b' : '#ef4444',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                🌍 Markets: {sessionStatus.overallStatus === 'open' ? '✅ OPEN' : 
                           sessionStatus.overallStatus === 'partial' ? '⚠️ PARTIAL' : '❌ CLOSED'}
                <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.9 }}>
                  {sessionStatus.sessions.future.symbol}: {sessionStatus.sessions.future.isOpen ? '✅' : '❌'} | {' '}
                  {sessionStatus.sessions.spot.symbol}: {sessionStatus.sessions.spot.isOpen ? '✅' : '❌'}
                </div>
              </div>
            )}
          </div>
        )}
        
        <main className="dashboard-content">
          <div className="dashboard-header">
            <h1>Welcome, {user.email}</h1>
            <p>Monitor your trading performance and manage your accounts</p>
          </div>

          {accountSets.length > 0 && (
            <div className="modern-selector-section">
              <div className="selector-group">
                <label>
                  <strong>Account Set:</strong>
                  <select
                    value={selectedSetId}
                    onChange={e => setSelectedSetId(e.target.value)}
                    className="modern-select"
                  >
                    {accountSets.map(s => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="symbol-selectors">
                {currentSet && currentSet.symbolsLocked ? (
                  <>
                    <div className="symbol-group">
                      <label>
                        <strong>Future (Locked):</strong>
                        <div className="locked-symbol">
                          <Lock style={{ width: '16px', height: '16px' }} />
                          <span>{currentSet.futureSymbol}</span>
                        </div>
                      </label>
                      {lockedFutureQuote && (
                        <div className="quote-display">
                          <span className="bid">Bid: {lockedFutureQuote.bid?.toFixed(2)}</span>
                          <span className="ask">Ask: {lockedFutureQuote.ask?.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="symbol-group">
                      <label>
                        <strong>Spot (Locked):</strong>
                        <div className="locked-symbol">
                          <Lock style={{ width: '16px', height: '16px' }} />
                          <span>{currentSet.spotSymbol}</span>
                        </div>
                      </label>
                      {lockedSpotQuote && (
                        <div className="quote-display">
                          <span className="bid">Bid: {lockedSpotQuote.bid?.toFixed(2)}</span>
                          <span className="ask">Ask: {lockedSpotQuote.ask?.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="symbol-stats">
                      <button
                        onClick={handleUnlockSymbols}
                        className="unlock-btn"
                      >
                        <Unlock style={{ width: '16px', height: '16px' }} />
                        Unlock
                      </button>
                      <div className="premium-display">
                        <div>Buy Premium: {buyPremium.toFixed(2)}</div>
                        <div>Sell Premium: {sellPremium.toFixed(2)}</div>
                        {(futureQuote?.source || spotQuote?.source) && (
                          <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                            Data: {futureQuote?.source === 'api' ? '🌐' : '💾'} Future{futureQuote?.wsSpeed !== undefined ? ` (${futureQuote.wsSpeed}ms)` : ''}, {spotQuote?.source === 'api' ? '🌐' : '💾'} Spot{spotQuote?.wsSpeed !== undefined ? ` (${spotQuote.wsSpeed}ms)` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="symbol-group">
                      <label>
                        <strong>Future:</strong>
                        <input
                          type="text"
                          list="futureSymbolsList"
                          value={futureSymbol}
                          onChange={async (e) => {
                            const value = e.target.value;
                            setFutureSymbol(value);
                            await handleSmartSymbolRefresh(value, broker1Symbols, broker1Id, broker1Term);
                          }}
                          placeholder="Search symbols..."
                          disabled={symbolsLoading}
                          className="modern-input"
                        />
                      </label>
                      <datalist id="futureSymbolsList">
                        {broker1Symbols.map((sym, i) => (
                          <option key={`fut-${i}`} value={typeof sym === 'object' ? (sym.currency || sym.symbol || sym.name || JSON.stringify(sym)) : sym}/>
                        ))}
                      </datalist>
                      {futureQuote && (
                        <div className="quote-display">
                          <span className="bid">Bid: {futureQuote.bid?.toFixed(2)}</span>
                          <span className="ask">Ask: {futureQuote.ask?.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="symbol-group">
                      <label>
                        <strong>Spot:</strong>
                        <input
                          type="text"
                          list="spotSymbolsList"
                          value={spotSymbol}
                          onChange={async (e) => {
                            const value = e.target.value;
                            setSpotSymbol(value);
                            await handleSmartSymbolRefresh(value, broker2Symbols, broker2Id, broker2Term);
                          }}
                          placeholder="Search symbols..."
                          disabled={symbolsLoading}
                          className="modern-input"
                        />
                      </label>
                      <datalist id="spotSymbolsList">
                        {broker2Symbols.map((sym, i) => (
                          <option key={`spot-${i}`} value={typeof sym === 'object' ? (sym.currency || sym.symbol || sym.name || JSON.stringify(sym)) : sym}/>
                        ))}
                      </datalist>
                      {spotQuote && (
                        <div className="quote-display">
                          <span className="bid">Bid: {spotQuote.bid?.toFixed(2)}</span>
                          <span className="ask">Ask: {spotQuote.ask?.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="symbol-stats">
                      {symbolsLoading ? (
                        <span className="loading-text">Loading symbols...</span>
                      ) : (
                        <>
                          <span>✓ Future: {broker1Symbols.length} symbols</span>
                          <span>✓ Spot: {broker2Symbols.length} symbols</span>
                          <button
                            onClick={handleSubmitSymbols}
                            disabled={submitting || !futureSymbol || !spotSymbol}
                            className="submit-btn"
                          >
                            {submitting ? 'Submitting...' : 'Submit'}
                          </button>
                          {submitMessage && (
                            <span className={`submit-message ${submitMessage.includes('Failed') ? 'error' : 'success'}`}>
                              {submitMessage}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="performance-grid">
            <div className="performance-card broker1">
              <div className="card-header">
                <div className="card-icon">
                  <TrendingUp style={{ width: '24px', height: '24px', color: '#4a90e2' }} />
                </div>
                <div className="card-info">
                  <h3>Broker 1 ({broker1Term || 'Not Set'})</h3>
                  <p>Balance: ${(b1.balance || 0).toLocaleString()} | Equity: ${(b1.equity || 0).toLocaleString()}</p>
                  {(b1.balance === 0 && b1.equity === 0) && (
                    <small style={{ color: '#f59e0b', fontSize: '10px' }}>
                      ⚠️ Balance loading... (Check WebSocket)
                    </small>
                  )}
                </div>
              </div>
              <div className="card-value">
                {broker1FluxProfit !== 0 ? `$${broker1FluxProfit.toLocaleString()}` : '$0'}
              </div>
              <div className={`card-change ${broker1FluxProfit >= 0 ? 'positive' : 'negative'}`}>
                {broker1FluxProfit !== 0 ? `${broker1FluxProfit >= 0 ? '+' : ''}${broker1FluxProfit.toLocaleString()}` : '+0'} (FluxNetwork P&L)
              </div>
            </div>

            <div className="performance-card broker2">
              <div className="card-header">
                <div className="card-icon">
                  <BarChart3 style={{ width: '24px', height: '24px', color: '#9013fe' }} />
                </div>
                <div className="card-info">
                  <h3>Broker 2 ({broker2Term || 'Not Set'})</h3>
                  <p>Balance: ${(b2.balance || 0).toLocaleString()} | Equity: ${(b2.equity || 0).toLocaleString()}</p>
                  {(b2.balance === 0 && b2.equity === 0) && (
                    <small style={{ color: '#f59e0b', fontSize: '10px' }}>
                      ⚠️ Balance loading... (Check WebSocket)
                    </small>
                  )}
                </div>
              </div>
              <div className="card-value">
                {broker2FluxProfit !== 0 ? `$${broker2FluxProfit.toLocaleString()}` : '$0'}
              </div>
              <div className={`card-change ${broker2FluxProfit >= 0 ? 'positive' : 'negative'}`}>
                {broker2FluxProfit !== 0 ? `${broker2FluxProfit >= 0 ? '+' : ''}${broker2FluxProfit.toLocaleString()}` : '+0'} (FluxNetwork P&L)
              </div>
            </div>

            <div className="performance-card pnl">
              <div className="card-header">
                <div className="card-icon">
                  <DollarSign style={{ width: '24px', height: '24px', color: '#7ed321' }} />
                </div>
                <div className="card-info">
                  <h3>FluxNetwork Open P&L</h3>
                  <p>Open Orders: {totalOpenOrders} | Lots: {totalOpenLots.toFixed(2)} | Avg. Premium: {avgPremium.toFixed(2)}</p>
                </div>
              </div>
              <div className="card-value">
                {totalFluxNetworkProfit !== 0 ? `$${totalFluxNetworkProfit.toLocaleString()}` : '$0'}
              </div>
              <div className={`card-change ${totalFluxNetworkProfit >= 0 ? 'positive' : 'negative'}`}>
                {totalFluxNetworkProfit >= 0 ? 'Profit' : 'Loss'} (FluxNetwork Only)
              </div>
            </div>

            <div className="performance-card overall">
              <div className="card-header">
                <div className="card-icon">
                  <BarChart3 style={{ width: '24px', height: '24px', color: '#ff9800' }} />
                </div>
                <div className="card-info">
                  <h3>FluxNetwork Total Profit</h3>
                  <p>Closed Trades: {closedTrades.length}</p>
                </div>
              </div>
              <div className="card-value">
                {overallFluxProfit !== 0 ? `$${overallFluxProfit.toLocaleString()}` : '$0'}
              </div>
              <div className={`card-change ${overallFluxProfit >= 0 ? 'positive' : 'negative'}`}>
                {overallFluxProfit >= 0 ? 'Total Gain' : 'Total Loss'} (FluxNetwork Only)
              </div>
            </div>

            <div className="performance-card spread">
              <div className="card-header">
                <div className="card-icon">
                  <Activity style={{ width: '24px', height: '24px', color: '#50e3c2' }} />
                </div>
                <div className="card-info">
                  <h3>Premium Spread</h3>
                  <p>Market Analysis</p>
                </div>
              </div>
              <div className="spread-values">
                <div>Buy: {buyPremium.toFixed(2)}</div>
                <div>Sell: {sellPremium.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="chart-section">
            {currentSet.symbolsLocked && selectedSetId ? (
              <SellPremiumChart 
                timeframe={selectedTimeframe}
                accountSetId={selectedSetId}
                currentSet={currentSet}
                debug={false}
              />
            ) : (
              <>
                <div className="section-header">
                  <h2>Premium Chart</h2>
                  <p>Real-time market analysis</p>
                  <div className="timeframe-selector">
                    <Clock style={{ width: '18px', height: '18px', marginRight: '8px' }} />
                    <select
                      value={selectedTimeframe}
                      onChange={e => setSelectedTimeframe(Number(e.target.value))}
                      className="timeframe-select"
                    >
                      {timeframeOptions.map(tf => (
                        <option key={tf.value} value={tf.value}>{tf.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="chart-container">
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '400px',
                    color: '#94a3b8',
                    backgroundColor: 'rgba(30, 41, 59, 0.3)',
                    borderRadius: '8px',
                    border: '2px dashed rgba(71, 85, 105, 0.5)'
                  }}>
                    <Lock style={{ width: '48px', height: '48px', marginBottom: '16px', opacity: 0.6 }} />
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Chart Unavailable</h3>
                    <p style={{ margin: 0, textAlign: 'center', lineHeight: '1.5' }}>
                      Please lock symbols in the Account Set above<br />
                      to start premium tracking and view the chart
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

        </main>
      </div>
    </DashboardContext.Provider>
  );
}