import React, { useState, useEffect, useRef, createContext, useCallback } from 'react';
import API from '../services/api';
import { fetchBalance, fetchSymbols, fetchQuote } from '../services/api';
import SellPremiumChart from '../components/SellPremiumChart';
import { connectWS, onMessage, offMessage, subscribeToQuotes, isWSConnected, getWSStatus, clearQuoteSubscriptions } from '../services/wsService';
import { TrendingUp, DollarSign, BarChart3, Activity, Copy, CheckCircle, AlertTriangle, Link as LinkIcon, Lock, Unlock, Clock } from 'lucide-react';
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
  const [selectedTimeframe, setSelectedTimeframe] = useState(15);
  
  const currentSet = accountSets.find(s => s._id === selectedSetId) || { brokers: [] };
  const [brokerBalances, setBrokerBalances] = useState({});
  const [tradeMapping, setTradeMapping] = useState([]);
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
  const [copyStatus, setCopyStatus] = useState('');
  const latestRef = useRef({});
  const [wsConnected, setWsConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const lastBalanceUpdate = useRef(Date.now());
  const wsStatusCheckInterval = useRef(null);
  const brokerLookupCache = useRef(new Map());
  const balanceUpdateDebounce = useRef(null);
  
  const brokers = currentSet.brokers || [];
  const sortedBrokers = [...brokers].sort((a, b) => (a.position || 0) - (b.position || 0));
  const broker1 = sortedBrokers.find(b => b.position === 1) || {};
  const broker2 = sortedBrokers.find(b => b.position === 2) || {};
  const broker1Term = broker1.terminal || '';
  const broker2Term = broker2.terminal || '';
  const key1 = broker1.server && broker1.accountNumber && broker1.position
    ? `${broker1.server}|${broker1.accountNumber}|${broker1.terminal}|pos${broker1.position}`
    : '';
  const key2 = broker2.server && broker2.accountNumber && broker2.position
    ? `${broker2.server}|${broker2.accountNumber}|${broker2.terminal}|pos${broker2.position}`
    : '';
  const broker1Id = broker1.id || broker1._id;
  const broker2Id = broker2.id || broker2._id;
  const b1 = brokerBalances[key1] || { balance: 0, profit: 0 };
  const b2 = brokerBalances[key2] || { balance: 0, profit: 0 };
  const overallNetProfit = tradeMapping.length > 0
    ? tradeMapping.reduce((sum, t) => sum + (t.mt4Profit || 0) + (t.mt5Profit || 0), 0)
    : Object.values(brokerBalances).reduce((sum, b) => sum + (b.profit || 0), 0);
  const totalOpenOrders = tradeMapping.length;
  const totalOpenLots = tradeMapping.reduce((sum, t) => sum + (t.lots || 0), 0);
  const referralLink = `${window.location.origin}/signup?ref=${user?.referralCode || ''}`;
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
      if (typedSymbol.length > 2 && !symbolsList.includes(typedSymbol)) {
        try {
          await API.post('/trading/refresh-symbols', { brokerId, terminal });
          const res = await fetchSymbols(terminal, brokerId);
          const raw = res.data?.symbols;
          const list = Array.isArray(raw) ? raw : Object.values(raw || {});
          const processed = list
            .map(o => o.currency || o.symbol || o.name)
            .filter(sym => sym && sym.trim());
          if (brokerId === broker1Id) {
            setBroker1Symbols(processed);
          } else if (brokerId === broker2Id) {
            setBroker2Symbols(processed);
          }
        } catch (err) {
        }
      }
    },
    [broker1Id, broker2Id]
  );

  useEffect(() => {
    API.get('/users/me')
      .then(r => setUser(r.data))
      .catch(() => {
        setUser({ email: 'User', referralCode: 'HDtqsCQO' });
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

  useEffect(() => {
    if (!currentSet.symbolsLocked) return;
    fetchQuote(currentSet.futureSymbol, broker1Term, broker1Id)
      .then(res => setLockedFutureQuote(res.data.data))
      .catch(err => {
        setLockedFutureQuote(null);
      });
    fetchQuote(currentSet.spotSymbol, broker2Term, broker2Id)
      .then(res => setLockedSpotQuote(res.data.data))
      .catch(err => {
        setLockedSpotQuote(null);
      });
  }, [
    currentSet.symbolsLocked,
    currentSet.futureSymbol,
    currentSet.spotSymbol,
    broker1Term,
    broker2Term,
    broker1Id,
    broker2Id
  ]);

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

    const handleQuoteUpdate = (data) => {
      console.log('📈 Quote update received:', data);
      console.log('🔒 Symbols locked:', currentSet.symbolsLocked);
      console.log('🎯 Expected symbols:', { 
        future: currentSet.symbolsLocked ? currentSet.futureSymbol : futureSymbol,
        spot: currentSet.symbolsLocked ? currentSet.spotSymbol : spotSymbol
      });
      
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
        
        if (data.spotSymbol === currentSet.spotSymbol && data.spotQuote) {
          console.log('✅ Updating spot quote for locked symbols:', data.spotQuote);
          setSpotQuote(data.spotQuote);
          setLockedSpotQuote(data.spotQuote);
        } else {
          console.log('❌ Spot symbol mismatch or missing quote:', {
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
        if (data.spotSymbol === spotSymbol && data.spotQuote) {
          console.log('✅ Updating spot quote for unlocked symbols:', data.spotQuote);
          setSpotQuote(data.spotQuote);
        }
      }
    };

    const handleBalanceUpdate = (data) => {
      // Clear previous debounce
      if (balanceUpdateDebounce.current) {
        clearTimeout(balanceUpdateDebounce.current);
      }
      
      // Debounce balance updates to reduce re-renders
      balanceUpdateDebounce.current = setTimeout(() => {
        const brokerId = data.brokerId || data.data?.brokerId;
        const balanceData = data.data || data;
        
        if (!brokerId || !currentSet.brokers?.length) {
          return;
        }
        
        // Use cached broker lookup for performance
        let broker = brokerLookupCache.current.get(brokerId);
        if (!broker) {
          broker = currentSet.brokers.find(x => 
            (x.id === brokerId) || (x._id === brokerId)
          );
          if (broker) {
            brokerLookupCache.current.set(brokerId, broker);
          }
        }
        
        if (!broker) return;
        
        const key = `${broker.server}|${broker.accountNumber}|${broker.terminal}|pos${broker.position}`;
        setBrokerBalances(prev => ({
          ...prev,
          [key]: {
            balance: balanceData.balance || 0,
            profit: balanceData.profit || 0
          }
        }));
        
        lastBalanceUpdate.current = Date.now();
        setWsConnected(true);
      }, 50); // 50ms debounce
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

    // Register message handlers FIRST
    const unsubConnection = onMessage('connection', handleConnectionConfirmed);
    const unsubSubscription = onMessage('subscription_confirmed', handleSubscriptionConfirmed);
    const unsubQuote = onMessage('quote_update', handleQuoteUpdate);
    const unsubBal = onMessage('balance', handleBalanceUpdate);
    const unsubErr = onMessage('error', handleError);
    const unsubTrade = onMessage('trade_mapping', handleTradeMapping);

    // Connect to WebSocket
    connectWS(selectedSetId);
    
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
      
      // Check if we've missed balance updates
      const timeSinceLastUpdate = Date.now() - lastBalanceUpdate.current;
      if (timeSinceLastUpdate > 30000) { // 30 seconds (increased from 15)
        setWsConnected(false);
      }
    }, 5000); // Reduced polling frequency from 2s to 5s

    wsStatusCheckInterval.current = statusCheck;
    
    return () => {
      console.log('🧹 Cleaning up WebSocket subscriptions');
      clearInterval(statusCheck);
      unsubConnection();
      unsubSubscription();
      unsubQuote();
      unsubBal();
      unsubErr();
      unsubTrade();
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

  useEffect(() => {
    if (!selectedSetId || currentSet.symbolsLocked) {
      setBroker1Symbols([]);
      setBroker2Symbols([]);
      return;
    }

    if (!broker1Id || !broker2Id) {
      return;
    }

    setSymbolsLoading(true);
    setErrorMsg('');

    (async () => {
      try {
        let symbols1 = [];
        let symbols2 = [];

        if (broker1Id && broker1Term) {
          try {
            const res1 = await fetchSymbols(broker1Term, broker1Id);
            const raw1 = res1.data?.symbols;
            symbols1 = (Array.isArray(raw1) ? raw1 : Object.values(raw1 || {}))
              .map(o => typeof o === 'string' ? o : o.currency || o.symbol || o.name)
              .filter(sym => sym && sym.trim());
          } catch (err) {
          }
        }

        if (broker2Id && broker2Term) {
          try {
            const res2 = await fetchSymbols(broker2Term, broker2Id);
            const raw2 = res2.data?.symbols;
            symbols2 = (Array.isArray(raw2) ? raw2 : Object.values(raw2 || {}))
              .map(o => typeof o === 'string' ? o : o.currency || o.symbol || o.name)
              .filter(sym => sym && sym.trim());
          } catch (err) {
          }
        }

        setBroker1Symbols(symbols1);
        setBroker2Symbols(symbols2);

        if (!symbols1.length && !symbols2.length) {
          setErrorMsg('No symbols loaded. Please check your account configuration.');
        }
      } catch (err) {
        setErrorMsg('Failed to load symbols. Please try again.');
      } finally {
        setSymbolsLoading(false);
      }
    })();
  }, [selectedSetId, currentSet.symbolsLocked, broker1Id, broker2Id, broker1Term, broker2Term, broker1.position, broker2.position]);

  // ✅ FIXED Premium calculation
  useEffect(() => {
    console.log('💎 Premium calculation triggered:', {
      symbolsLocked: currentSet.symbolsLocked,
      futureQuote,
      spotQuote,
      lockedFutureQuote,
      lockedSpotQuote
    });
    
    const activeQuotes = currentSet.symbolsLocked 
      ? { future: lockedFutureQuote || futureQuote, spot: lockedSpotQuote || spotQuote }
      : { future: futureQuote, spot: spotQuote };
      
    console.log('📈 Active quotes for premium calculation:', activeQuotes);
    
    if (activeQuotes.future && activeQuotes.spot) {
      const newBuyPremium = (activeQuotes.future.ask || 0) - (activeQuotes.spot.bid || 0);
      const newSellPremium = (activeQuotes.future.bid || 0) - (activeQuotes.spot.ask || 0);
      
      console.log('💰 Premium calculation results:', {
        buyPremium: newBuyPremium,
        sellPremium: newSellPremium,
        futureAsk: activeQuotes.future.ask,
        futureBid: activeQuotes.future.bid,
        spotBid: activeQuotes.spot.bid,
        spotAsk: activeQuotes.spot.ask
      });
      
      setBuyPremium(newBuyPremium);
      setSellPremium(newSellPremium);
    } else {
      console.log('⚠ Missing quotes for premium calculation');
      setBuyPremium(0);
      setSellPremium(0);
    }
  }, [futureQuote, spotQuote, lockedFutureQuote, lockedSpotQuote, currentSet.symbolsLocked]);

  const fetchQuotes = useCallback(async () => {
    if (!futureSymbol || !spotSymbol || !broker1Id || !broker2Id) {
      setFutureQuote(null);
      setSpotQuote(null);
      return;
    }

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

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus(''), 2000);
  };

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
            backgroundColor: wsConnected ? '#22c55e' : '#ef4444',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {wsConnected ? '✅ WebSocket Connected' : `🔌 WebSocket ${wsStatus}`}
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
                          <span className="bid">Bid: {lockedFutureQuote.bid?.toFixed(3)}</span>
                          <span className="ask">Ask: {lockedFutureQuote.ask?.toFixed(3)}</span>
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
                          <span className="bid">Bid: {lockedSpotQuote.bid?.toFixed(3)}</span>
                          <span className="ask">Ask: {lockedSpotQuote.ask?.toFixed(3)}</span>
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
                        <div>Buy Premium: {buyPremium.toFixed(3)}</div>
                        <div>Sell Premium: {sellPremium.toFixed(3)}</div>
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
                          <span className="bid">Bid: {futureQuote.bid?.toFixed(3)}</span>
                          <span className="ask">Ask: {futureQuote.ask?.toFixed(3)}</span>
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
                          <span className="bid">Bid: {spotQuote.bid?.toFixed(3)}</span>
                          <span className="ask">Ask: {spotQuote.ask?.toFixed(3)}</span>
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
                  <h3>Broker 1 ({broker1Term})</h3>
                  <p>Balance</p>
                </div>
              </div>
              <div className="card-value">${b1.balance.toLocaleString()}</div>
              <div className={`card-change ${b1.profit >= 0 ? 'positive' : 'negative'}`}>
                {b1.profit >= 0 ? '+' : ''}{b1.profit.toLocaleString()}
              </div>
            </div>

            <div className="performance-card broker2">
              <div className="card-header">
                <div className="card-icon">
                  <BarChart3 style={{ width: '24px', height: '24px', color: '#9013fe' }} />
                </div>
                <div className="card-info">
                  <h3>Broker 2 ({broker2Term})</h3>
                  <p>Balance</p>
                </div>
              </div>
              <div className="card-value">${b2.balance.toLocaleString()}</div>
              <div className={`card-change ${b2.profit >= 0 ? 'positive' : 'negative'}`}>
                {b2.profit >= 0 ? '+' : ''}{b2.profit.toLocaleString()}
              </div>
            </div>

            <div className="performance-card pnl">
              <div className="card-header">
                <div className="card-icon">
                  <DollarSign style={{ width: '24px', height: '24px', color: '#7ed321' }} />
                </div>
                <div className="card-info">
                  <h3>Current P&L</h3>
                  <p>Open Orders: {totalOpenOrders} | Lots: {totalOpenLots.toFixed(2)}</p>
                </div>
              </div>
              <div className="card-value">${overallNetProfit.toLocaleString()}</div>
              <div className={`card-change ${overallNetProfit >= 0 ? 'positive' : 'negative'}`}>
                {overallNetProfit >= 0 ? 'Profit' : 'Loss'}
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

          <div className="info-grid">
            <div className="info-card status-card">
              <div className="card-header">
                <h3>Trading API Status</h3>
                <div className={`status-indicator ${tradingStatus.includes('available') ? 'online' : 'offline'}`}>
                  <div className="status-dot"></div>
                  {tradingStatus.includes('available') ? 'Online' : 'Offline'}
                </div>
              </div>
              <p>{tradingStatus}</p>
            </div>

            <div className="info-card referral-card">
              <div className="card-header">
                <h3>Your Referral Link</h3>
              </div>
              <div className="referral-input-group">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  onFocus={e => e.target.select()}
                  className="referral-input"
                />
                <button
                  onClick={copyReferralLink}
                  className="copy-btn"
                >
                  {copyStatus === 'copied' ? (
                    <>
                      <CheckCircle style={{ width: '16px', height: '16px' }} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy style={{ width: '16px', height: '16px' }} />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="info-card accounts-card">
              <div className="card-header">
                <h3>Linked Accounts</h3>
                <a href="/link-account" className="link-account-btn">
                  <LinkIcon style={{ width: '16px', height: '16px' }} />
                  Manage
                </a>
              </div>
              <div className="account-list">
                <div className="account-item">
                  <strong>MT4:</strong> 
                  <span>{currentSet.brokers.find(b => b.terminal==='MT4')?.server || 'Not linked'}</span>
                </div>
                <div className="account-item">
                  <strong>MT5:</strong> 
                  <span>{currentSet.brokers.find(b => b.terminal==='MT5')?.server || 'Not linked'}</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </DashboardContext.Provider>
  );
}