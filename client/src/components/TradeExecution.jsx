import React, { useEffect, useState, useCallback, useRef } from 'react';
import { fetchSymbols, fetchQuote } from '../services/api';
import symbolsCache from '../services/symbolsCache';
import { connectWS, onMessage, subscribeToQuotes, wsManager, createBrokerKey, isQuoteFresh, validateTradeQuotes, onBalanceBatch, onQuoteBatch } from '../services/wsService';
import { TrendingUp, TrendingDown, Zap, Target, Activity, BarChart3, Search, Settings, AlertTriangle } from 'lucide-react';
import API from '../services/api';
import './TradeExecution.css';

export default function TradeExecution({
  accountSet: propAccountSet, // Account set from props (if any)
}) {
  // ✅ ENHANCEMENT: Trade state management for preventing duplicates and partials
  const [pendingTrades, setPendingTrades] = useState(new Set());
  const [executingTrades, setExecutingTrades] = useState(new Set());
  const executionLocks = useRef(new Set());
  const executionTimeouts = useRef(new Map());
  
  // ✅ ENHANCEMENT: Enhanced execution state with detailed tracking
  const [executionState, setExecutionState] = useState({
    isExecuting: false,
    step: '',
    startTime: null,
    broker1Status: 'idle', // idle, pending, success, failed
    broker2Status: 'idle'
  });
  const [broker1Symbols, setBroker1Symbols] = useState([]);
  const [broker2Symbols, setBroker2Symbols] = useState([]);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
  const [executing, setExecuting] = useState(false);
  
  // ✅ ENHANCEMENT: Update executing state to use new execution state
  useEffect(() => {
    setExecuting(executionState.isExecuting);
  }, [executionState.isExecuting]);
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
  // ✅ FIX 6: Trade validation state
  const [quotesValidForTrading, setQuotesValidForTrading] = useState(false);
  const [quotesFreshness, setQuotesFreshness] = useState({ futureValid: false, spotValid: false });

  // Removed latency monitoring - not needed

  // ─── STANDALONE MODE: Load account sets if not provided ───
  const [accountSets, setAccountSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  
  // Use prop accountSet if provided, otherwise use selected from state
  const accountSet = propAccountSet || accountSets.find(s => s._id === selectedSetId);

  // ✅ ENHANCEMENT 1: Enhanced Partial Trade Prevention
  const validateTradeState = useCallback((tradeKey) => {
    const isNotPending = !pendingTrades.has(tradeKey);
    const isNotExecuting = !executingTrades.has(tradeKey);
    const isNotLocked = !executionLocks.current.has(tradeKey);
    
    console.log('🔍 Trade state validation:', {
      tradeKey,
      isNotPending,
      isNotExecuting,
      isNotLocked,
      canExecute: isNotPending && isNotExecuting && isNotLocked
    });
    
    return isNotPending && isNotExecuting && isNotLocked;
  }, [pendingTrades, executingTrades]);

  // ✅ ENHANCEMENT 2: Duplicate Execution Prevention
  const preventDuplicateExecution = useCallback((tradeKey) => {
    if (executionLocks.current.has(tradeKey)) {
      console.warn('🚫 Duplicate execution prevented for:', tradeKey);
      return false;
    }
    
    console.log('🔒 Locking execution for:', tradeKey);
    executionLocks.current.add(tradeKey);
    
    // Auto-release lock after 60 seconds as safety measure
    setTimeout(() => {
      if (executionLocks.current.has(tradeKey)) {
        console.log('⏰ Auto-releasing execution lock for:', tradeKey);
        executionLocks.current.delete(tradeKey);
      }
    }, 60000);
    
    return true;
  }, []);

  // ✅ ENHANCEMENT: Release execution lock
  const releaseExecutionLock = useCallback((tradeKey) => {
    console.log('🔓 Releasing execution lock for:', tradeKey);
    executionLocks.current.delete(tradeKey);
  }, []);

  // ✅ ENHANCEMENT 3: Timeout Handler for Slow Brokers
  const createExecutionTimeout = useCallback((tradeKey, timeoutMs = 30000) => {
    const timeoutId = setTimeout(() => {
      console.error('⏰ Execution timeout for:', tradeKey);
      setExecutionState(prev => ({ 
        ...prev, 
        isExecuting: false, 
        step: 'Execution timeout - please check broker connections' 
      }));
      
      // Clean up
      releaseExecutionLock(tradeKey);
      setExecutingTrades(prev => {
        const newSet = new Set(prev);
        newSet.delete(tradeKey);
        return newSet;
      });
    }, timeoutMs);
    
    executionTimeouts.current.set(tradeKey, timeoutId);
    return timeoutId;
  }, [releaseExecutionLock]);

  // ✅ ENHANCEMENT: Clear execution timeout
  const clearExecutionTimeout = useCallback((tradeKey) => {
    const timeoutId = executionTimeouts.current.get(tradeKey);
    if (timeoutId) {
      clearTimeout(timeoutId);
      executionTimeouts.current.delete(tradeKey);
      console.log('⏰ Cleared execution timeout for:', tradeKey);
    }
  }, []);

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

  // ✅ ENHANCEMENT 4: Enhanced Rollback Mechanism
  const rollbackExecution = useCallback(async (tradeKey, reason, broker1Result = null, broker2Result = null) => {
    console.error('🔄 Rolling back execution:', { tradeKey, reason, broker1Result, broker2Result });
    
    setExecutionState(prev => ({ 
      ...prev, 
      step: `Rolling back: ${reason}`,
      broker1Status: broker1Result ? 'rollback' : prev.broker1Status,
      broker2Status: broker2Result ? 'rollback' : prev.broker2Status
    }));
    
    // Attempt to close any successfully opened positions
    const rollbackPromises = [];
    
    if (broker1Result?.success && broker1Result?.ticket) {
      rollbackPromises.push(
        API.post('/trading/close-position', {
          brokerId: broker1Id,
          ticket: broker1Result.ticket,
          reason: `Rollback: ${reason}`
        }).catch(err => {
          console.error('❌ Failed to rollback broker1 position:', err);
          return { success: false, error: err.message };
        })
      );
    }
    
    if (broker2Result?.success && broker2Result?.ticket) {
      rollbackPromises.push(
        API.post('/trading/close-position', {
          brokerId: broker2Id,
          ticket: broker2Result.ticket,
          reason: `Rollback: ${reason}`
        }).catch(err => {
          console.error('❌ Failed to rollback broker2 position:', err);
          return { success: false, error: err.message };
        })
      );
    }
    
    if (rollbackPromises.length > 0) {
      try {
        const rollbackResults = await Promise.allSettled(rollbackPromises);
        console.log('🔄 Rollback results:', rollbackResults);
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    }
    
    // Clean up state
    releaseExecutionLock(tradeKey);
    clearExecutionTimeout(tradeKey);
    setExecutingTrades(prev => {
      const newSet = new Set(prev);
      newSet.delete(tradeKey);
      return newSet;
    });
  }, [broker1Id, broker2Id, releaseExecutionLock, clearExecutionTimeout]);

  // ✅ ENHANCEMENT 3: Faster Simultaneous Execution with Parallel Promises
  const executeParallelOrders = useCallback(async (orderData) => {
    const tradeKey = `${selectedBroker1}_${selectedBroker2}_${Date.now()}`;
    
    console.log('🚀 Starting parallel execution:', { tradeKey, orderData });
    
    setExecutionState(prev => ({
      ...prev,
      step: 'Preparing parallel execution...',
      broker1Status: 'pending',
      broker2Status: 'pending'
    }));
    
    // Create execution timeout
    createExecutionTimeout(tradeKey, 30000); // 30 second timeout
    
    try {
      // ✅ ENHANCEMENT: Prepare both broker orders simultaneously
      const broker1OrderData = {
        ...orderData,
        brokerId: broker1Id,
        symbol: selectedBroker1,
        terminal: broker1Terminal
      };
      
      const broker2OrderData = {
        ...orderData,
        brokerId: broker2Id,
        symbol: selectedBroker2,
        terminal: broker2Terminal
      };
      
      setExecutionState(prev => ({ ...prev, step: 'Executing both brokers simultaneously...' }));
      
      // ✅ ENHANCEMENT: Execute both orders in parallel with timeout handling
      const executionPromises = [
        Promise.race([
          API.post('/trading/execute-single-broker', broker1OrderData),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Broker1 execution timeout')), 15000)
          )
        ]),
        Promise.race([
          API.post('/trading/execute-single-broker', broker2OrderData),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Broker2 execution timeout')), 15000)
          )
        ])
      ];
      
      // Wait for both executions to complete
      const results = await Promise.allSettled(executionPromises);
      const [broker1Result, broker2Result] = results;
      
      console.log('🏁 Parallel execution results:', { broker1Result, broker2Result });
      
      // Analyze results
      const broker1Success = broker1Result.status === 'fulfilled' && broker1Result.value?.data?.success;
      const broker2Success = broker2Result.status === 'fulfilled' && broker2Result.value?.data?.success;
      
      setExecutionState(prev => ({
        ...prev,
        broker1Status: broker1Success ? 'success' : 'failed',
        broker2Status: broker2Success ? 'success' : 'failed'
      }));
      
      // Check for partial execution
      if (broker1Success && broker2Success) {
        // ✅ PERFECT: Both trades executed successfully
        console.log('✅ Perfect execution: Both brokers successful!');
        setExecutionState(prev => ({ ...prev, step: 'Both trades executed successfully!' }));
        
        clearExecutionTimeout(tradeKey);
        releaseExecutionLock(tradeKey);
        
        return { success: true, message: 'Trade executed successfully on both brokers!' };
        
      } else if (broker1Success || broker2Success) {
        // ❌ PARTIAL EXECUTION: Roll back the successful one
        const successfulBroker = broker1Success ? 'Broker1' : 'Broker2';
        const failedBroker = broker1Success ? 'Broker2' : 'Broker1';
        
        console.error('⚠️ Partial execution detected:', { successfulBroker, failedBroker });
        
        setExecutionState(prev => ({ 
          ...prev, 
          step: `Partial execution detected - rolling back ${successfulBroker}...` 
        }));
        
        // Rollback the successful execution
        await rollbackExecution(
          tradeKey, 
          `${failedBroker} execution failed`, 
          broker1Success ? broker1Result.value?.data : null,
          broker2Success ? broker2Result.value?.data : null
        );
        
        const failedError = broker1Success ? 
          broker2Result.reason?.message || 'Broker2 execution failed' :
          broker1Result.reason?.message || 'Broker1 execution failed';
        
        throw new Error(`Partial execution prevented - ${failedBroker} failed: ${failedError}`);
        
      } else {
        // ❌ BOTH FAILED: No rollback needed
        console.error('❌ Both brokers failed to execute');
        
        const broker1Error = broker1Result.reason?.message || 'Unknown error';
        const broker2Error = broker2Result.reason?.message || 'Unknown error';
        
        throw new Error(`Both brokers failed - Broker1: ${broker1Error}, Broker2: ${broker2Error}`);
      }
      
    } catch (error) {
      console.error('❌ Parallel execution error:', error);
      clearExecutionTimeout(tradeKey);
      releaseExecutionLock(tradeKey);
      throw error;
    }
  }, [selectedBroker1, selectedBroker2, broker1Id, broker2Id, broker1Terminal, broker2Terminal, createExecutionTimeout, clearExecutionTimeout, releaseExecutionLock, rollbackExecution]);

  // ─── ENHANCED Order execution functionality ───
  const executeOrder = useCallback(async (orderType) => {
    // Clear any previous errors
    setError('');
    
    // Basic validation
    if (!selectedBroker1 || !selectedBroker2 || !volume) {
      setError('Please select symbols and enter volume');
      return;
    }

    if (!accountSet?.id && !accountSet?._id) {
      setError('Please select an account set');
      return;
    }
    
    // ✅ ENHANCEMENT 1 & 2: Validate trade state and prevent duplicates
    const tradeKey = `${accountSet.id || accountSet._id}_${selectedBroker1}_${selectedBroker2}_${orderType}`;
    
    if (!validateTradeState(tradeKey)) {
      setError('Trade is already being processed or is in pending state');
      return;
    }
    
    if (!preventDuplicateExecution(tradeKey)) {
      setError('Duplicate execution prevented - please wait for current trade to complete');
      return;
    }

    // ✅ ENHANCEMENT: Set comprehensive execution state
    setExecutionState({
      isExecuting: true,
      step: 'Initializing execution...',
      startTime: Date.now(),
      broker1Status: 'idle',
      broker2Status: 'idle'
    });
    
    // Add to executing trades set
    setExecutingTrades(prev => new Set([...prev, tradeKey]));
    
    try {
      console.log('🚀 Enhanced order execution started:', {
        orderType,
        tradeKey,
        accountSetId: accountSet.id || accountSet._id,
        direction,
        volume: parseFloat(volume),
        selectedBroker1,
        selectedBroker2,
        quotesValidForTrading
      });

      // ✅ ENHANCEMENT 6: Enhanced quote validation for current orders
      if (orderType === 'current' && !quotesValidForTrading) {
        throw new Error('Quotes are too stale for safe execution. Please wait for fresh quotes.');
      }

      // Calculate take profit based on mode
      let takeProfitValue = null;
      if (takeProfitMode === 'None' || !takeProfit) {
        takeProfitValue = null;
      } else if (takeProfitMode === 'Premium') {
        takeProfitValue = parseFloat(takeProfit);
      } else if (takeProfitMode === 'Amount') {
        takeProfitValue = parseFloat(takeProfit);
      }

      const orderData = {
        accountSetId: accountSet.id || accountSet._id,
        direction,
        volume: parseFloat(volume),
        takeProfit: takeProfitValue,
        takeProfitMode,
        stopLoss: null,
        scalpingMode: scalping,
        comment: 'FluxNetwork Trade'
      };

      let result;
      let successMessage;

      if (orderType === 'current') {
        // ✅ ENHANCEMENT 3: Use new parallel execution for current orders
        setExecutionState(prev => ({ ...prev, step: 'Executing at current premium with parallel processing...' }));
        result = await executeParallelOrders(orderData);
        successMessage = 'Trade executed successfully at current premium on both brokers!';
      } else if (orderType === 'target') {
        if (!targetPremium) {
          throw new Error('Please enter target premium');
        }
        
        orderData.targetPremium = parseFloat(targetPremium);
        setExecutionState(prev => ({ ...prev, step: 'Creating pending order at target premium...' }));
        
        // For target orders, use existing endpoint (typically creates pending orders)
        const response = await API.post('/trading/execute-target', orderData);
        result = { success: response.data?.success, data: response.data };
        successMessage = 'Pending order created successfully!';
      }
      
      console.log('✅ Enhanced execution completed:', result);
      
      if (result.success) {
        // Clear form on success
        setVolume('');
        setTargetPremium('');
        setTakeProfit('');
        
        // Show success message
        setExecutionState(prev => ({ ...prev, step: successMessage }));
        
        // Success notification
        setTimeout(() => {
          alert(successMessage);
        }, 500);
        
        console.log('✅ Trade execution completed successfully');
      } else {
        throw new Error(result.message || 'Execution failed');
      }
      
    } catch (err) {
      console.error('❌ Enhanced order execution error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Order execution failed';
      setError(errorMessage);
      
      setExecutionState(prev => ({
        ...prev,
        step: `Error: ${errorMessage}`,
        broker1Status: 'failed',
        broker2Status: 'failed'
      }));
      
    } finally {
      // Always clean up execution state
      setTimeout(() => {
        setExecutionState({
          isExecuting: false,
          step: '',
          startTime: null,
          broker1Status: 'idle',
          broker2Status: 'idle'
        });
      }, 3000); // Keep status visible for 3 seconds
      
      // Clean up execution tracking
      releaseExecutionLock(tradeKey);
      setExecutingTrades(prev => {
        const newSet = new Set(prev);
        newSet.delete(tradeKey);
        return newSet;
      });
      
      // Refresh latency data after order execution
      try {
        await fetchLatencyData();
      } catch (latencyErr) {
        console.log('Failed to refresh latency after order:', latencyErr.message);
      }
    }
  }, [selectedBroker1, selectedBroker2, volume, direction, targetPremium, takeProfit, takeProfitMode, scalping, accountSet, quotesValidForTrading, validateTradeState, preventDuplicateExecution, executeParallelOrders, releaseExecutionLock, fetchLatencyData]);

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
    // ✅ FIX 3 & FIX 6: Enhanced quote handler with freshness validation
    const handleQuoteUpdate = (data) => {
      // Check if the update is for the symbols we are currently watching
      if (data.futureSymbol === selectedBroker1 && data.futureQuote) {
        // ✅ FIX 3: Validate quote freshness
        const futureValid = isQuoteFresh(data.futureQuote);
        setFutureQuote(data.futureQuote);
        setQuotesFreshness(prev => ({ ...prev, futureValid }));
        
        if (!futureValid) {
          console.warn('⚠️ TradeExecution: Received stale future quote:', {
            symbol: data.futureSymbol,
            age: data.futureQuote ? Date.now() - new Date(data.futureQuote.timestamp) : 'no quote'
          });
        }
      }
      if (data.spotSymbol === selectedBroker2 && data.spotQuote) {
        // ✅ FIX 3: Validate quote freshness
        const spotValid = isQuoteFresh(data.spotQuote);
        setSpotQuote(data.spotQuote);
        setQuotesFreshness(prev => ({ ...prev, spotValid }));
        
        if (!spotValid) {
          console.warn('⚠️ TradeExecution: Received stale spot quote:', {
            symbol: data.spotSymbol,
            age: data.spotQuote ? Date.now() - new Date(data.spotQuote.timestamp) : 'no quote'
          });
        }
      }
    };

    // ✅ FIX 7: Enhanced batch quote handler
    const handleQuoteBatch = (quoteUpdates) => {
      console.log('📈 TradeExecution: Processing batched quote updates:', Object.keys(quoteUpdates).length);
      
      Object.values(quoteUpdates).forEach(data => {
        handleQuoteUpdate(data);
      });
    };

    // ✅ FIX 2: Universal handlers for TradeExecution
    const handleConnectionConfirmed = (data) => {
      console.log('✅ TradeExecution: WebSocket connection confirmed:', data);
    };

    const handleSubscriptionConfirmed = (data) => {
      console.log('✅ TradeExecution: Subscription confirmed:', data);
    };

    const handleApiError = (data) => {
      console.error('🚨 TradeExecution: API Error received:', data);
      setError(`API Error: ${data.message || 'Unknown error'}`);
      setTimeout(() => setError(''), 5000);
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

    // ✅ FIX 2: Register universal handlers
    const unsubQuote = onMessage('quote_update', handleQuoteUpdate);
    const unsubConnection = onMessage('connection', handleConnectionConfirmed);
    const unsubSubscription = onMessage('subscription_confirmed', handleSubscriptionConfirmed);
    const unsubApiError = onMessage('api_error', handleApiError);
    
    // ✅ FIX 7: Register batch handlers
    const unsubQuoteBatch = onQuoteBatch(handleQuoteBatch);

    // This cleanup function will be called when the component unmounts or dependencies change
    return () => {
      unsubQuote();
      unsubConnection();
      unsubSubscription();
      unsubApiError();
      unsubQuoteBatch();
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

  // ✅ FIX 3 & FIX 6: Enhanced premium calculation with freshness validation
  useEffect(() => {
    if (futureQuote && spotQuote) {
      // ✅ FIX 3: Validate quote freshness before calculating premiums
      const futureValid = isQuoteFresh(futureQuote);
      const spotValid = isQuoteFresh(spotQuote);
      
      if (futureValid && spotValid) {
        const calculatedBuyPremium = (futureQuote.ask || 0) - (spotQuote.bid || 0);
        const calculatedSellPremium = (futureQuote.bid || 0) - (spotQuote.ask || 0);
        
        setBuyPremium(calculatedBuyPremium);
        setSellPremium(calculatedSellPremium);
        
        // ✅ FIX 6: Validate quotes for trading
        const validForTrading = validateTradeQuotes(futureQuote, spotQuote);
        setQuotesValidForTrading(validForTrading);
        
        console.log('📈 Premium calculated:', {
          buyPremium: calculatedBuyPremium.toFixed(4),
          sellPremium: calculatedSellPremium.toFixed(4),
          validForTrading,
          futureQuote: { bid: futureQuote.bid, ask: futureQuote.ask },
          spotQuote: { bid: spotQuote.bid, ask: spotQuote.ask }
        });
      } else {
        console.warn('⚠️ Cannot calculate premium - stale quotes:', { futureValid, spotValid });
        setQuotesValidForTrading(false);
      }
    } else {
      setBuyPremium(0);
      setSellPremium(0);
      setQuotesValidForTrading(false);
    }
  }, [futureQuote, spotQuote]);

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

  // ✅ ENHANCEMENT: Helper functions for status display
  const getBrokerStatusColor = (status) => {
    switch (status) {
      case 'success': return '#10b981'; // green
      case 'failed': return '#ef4444'; // red
      case 'pending': return '#f59e0b'; // yellow/orange
      case 'rollback': return '#8b5cf6'; // purple
      default: return '#6b7280'; // gray
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'pending': return '⏳';
      case 'rollback': return '🔄';
      default: return '⏸️';
    }
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
          {/* ✅ FIX 3 & FIX 6: Enhanced premium display with freshness indicators */}
          <div className="status-item premium-spread">
            <div className={`status-indicator ${quotesValidForTrading ? 'online' : 'offline'}`}></div>
            <span>
              Premium Spread
              {quotesValidForTrading ? (
                <span style={{ color: '#4ade80', marginLeft: '4px', fontSize: '10px' }}>✅</span>
              ) : (
                <span style={{ color: '#f87171', marginLeft: '4px', fontSize: '10px' }}>⚠️</span>
              )}
            </span>
            <div className="spread-values">
              <div style={{ color: quotesValidForTrading ? '#4ade80' : '#9ca3af' }}>
                Buy: {buyPremium.toFixed(2)}
              </div>
              <div style={{ color: quotesValidForTrading ? '#f87171' : '#9ca3af' }}>
                Sell: {sellPremium.toFixed(2)}
              </div>
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
            {/* ✅ FIX 6: Enhanced execute button with trade validation */}
            <button 
              className="action-btn current-premium"
              onClick={() => executeOrder('current')}
              disabled={executionState.isExecuting || loadingSymbols || !selectedBroker1 || !selectedBroker2 || !volume || !accountSet || !quotesValidForTrading}
              title={
                !accountSet ? 'Please select an account set first' : 
                (!selectedBroker1 || !selectedBroker2) ? 'Please select symbols for both brokers' : 
                !volume ? 'Please enter volume' : 
                !quotesValidForTrading ? '⚠️ Quotes too stale for trading - please wait for fresh quotes' :
                'Execute trade at current premium'
              }
            >
              <div className="btn-content">
                {executionState.isExecuting ? (
                  <span>
                    {executionState.step || 'Executing...'}
                    <div style={{fontSize: '10px', marginTop: '2px', opacity: 0.8}}>
                      B1: {executionState.broker1Status} | B2: {executionState.broker2Status}
                    </div>
                  </span>
                ) : 'Execute at Current Premium'}
              </div>
              <div className="btn-glow"></div>
            </button>
            {/* ✅ FIX 6: Enhanced target premium button with validation */}
            <button 
              className="action-btn target-premium"
              onClick={() => executeOrder('target')}
              disabled={executionState.isExecuting || loadingSymbols || !selectedBroker1 || !selectedBroker2 || !volume || !targetPremium || !accountSet}
              title={
                !accountSet ? 'Please select an account set first' : 
                (!selectedBroker1 || !selectedBroker2) ? 'Please select symbols for both brokers' : 
                !volume ? 'Please enter volume' : 
                !targetPremium ? 'Please enter target premium' : 
                'Create pending order at target premium'
              }
            >
              <div className="btn-content">
                {executionState.isExecuting ? (
                  <span>
                    {executionState.step || 'Creating Order...'}
                    <div style={{fontSize: '10px', marginTop: '2px', opacity: 0.8}}>
                      B1: {executionState.broker1Status} | B2: {executionState.broker2Status}
                    </div>
                  </span>
                ) : 'Execute at Target Premium'}
              </div>
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
        .execution-status-panel {
          animation: pulseGlow 2s ease-in-out infinite alternate;
        }
        @keyframes pulseGlow {
          from { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
          to { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
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

      {/* ✅ ENHANCEMENT: Execution Status Panel */}
      {executionState.isExecuting && (
        <div className="trading-panel execution-status-panel" style={{ marginTop: '20px', border: '2px solid #3b82f6', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}>
          <div className="panel-header">
            <Activity style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
            <h2 style={{ color: '#3b82f6' }}>Live Execution Status</h2>
          </div>
          <div className="execution-progress" style={{ padding: '20px' }}>
            <div className="execution-step" style={{ 
              fontSize: '16px', 
              fontWeight: 'bold', 
              color: '#1e40af',
              marginBottom: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div className="progress-spinner" style={{
                width: '20px',
                height: '20px',
                border: '2px solid #e5e7eb',
                borderTop: '2px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              {executionState.step}
            </div>
            
            <div className="broker-status-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '15px', 
              marginTop: '15px' 
            }}>
              <div className="broker-status-card" style={{
                padding: '12px',
                border: `2px solid ${getBrokerStatusColor(executionState.broker1Status)}`,
                borderRadius: '8px',
                backgroundColor: 'white',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>BROKER 1 ({broker1Terminal})</div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  color: getBrokerStatusColor(executionState.broker1Status),
                  textTransform: 'uppercase'
                }}>
                  {getStatusIcon(executionState.broker1Status)} {executionState.broker1Status}
                </div>
              </div>
              
              <div className="broker-status-card" style={{
                padding: '12px',
                border: `2px solid ${getBrokerStatusColor(executionState.broker2Status)}`,
                borderRadius: '8px',
                backgroundColor: 'white',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>BROKER 2 ({broker2Terminal})</div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  color: getBrokerStatusColor(executionState.broker2Status),
                  textTransform: 'uppercase'
                }}>
                  {getStatusIcon(executionState.broker2Status)} {executionState.broker2Status}
                </div>
              </div>
            </div>
            
            {executionState.startTime && (
              <div style={{ 
                marginTop: '15px', 
                fontSize: '12px', 
                color: '#6b7280', 
                textAlign: 'center' 
              }}>
                Execution Time: {Math.floor((Date.now() - executionState.startTime) / 1000)}s
              </div>
            )}
          </div>
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