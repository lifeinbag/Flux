import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { subscribeToOpenOrders, onMessage, offMessage, connectWS, subscribeToQuotes, subscribeToPremium, subscribeToPositions } from '../services/wsService';
import mt4mt5Service from '../services/mt4mt5Service';

export default function ActiveTrades() {
  const [accountSets, setAccountSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [activeTrades, setActiveTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closingTrades, setClosingTrades] = useState(new Set());
  const [totalPnL, setTotalPnL] = useState(0);
  const [editingTP, setEditingTP] = useState({});
  const [tpValues, setTpValues] = useState({});
  const [savingTP, setSavingTP] = useState(new Set());
  
  // Premium spread state (same as Dashboard and TradeExecution)
  const [futureQuote, setFutureQuote] = useState(null);
  const [spotQuote, setSpotQuote] = useState(null);
  const [buyPremium, setBuyPremium] = useState(0);
  const [sellPremium, setSellPremium] = useState(0);

  const money = v => `$${(Number(v) || 0).toFixed(2)}`;

  useEffect(() => {
    loadAccountSets();
  }, []);

  useEffect(() => {
    if (selectedSetId) {
      loadActiveTrades();
      
      // Clean up previous subscriptions first
      if (window.wsCleanupFunctions) {
        window.wsCleanupFunctions.forEach(cleanup => cleanup());
        window.wsCleanupFunctions = [];
      }
      
      // Initialize MT4/MT5 service for this account set
      mt4mt5Service.initializeAccountSet(selectedSetId);
      
      // Subscribe to premium and positions updates for this account set
      const accountSet = accountSets.find(set => (set._id || set.id) === selectedSetId);
      if (accountSet) {
        // Add a small delay to ensure cleanup is complete
        setTimeout(() => {
          if (accountSet.futureSymbol && accountSet.spotSymbol) {
            subscribeToPremium(selectedSetId, accountSet.futureSymbol, accountSet.spotSymbol);
          }
          subscribeToPositions(selectedSetId);
        }, 100);
      }
      
      // Subscribe to real-time updates via WebSocket
      console.log('📡 ActiveTrades: Subscribing to open orders for:', selectedSetId);
      subscribeToOpenOrders(selectedSetId);
      
      // Clear premium data when account set changes
      setFutureQuote(null);
      setSpotQuote(null);
      setBuyPremium(0);
      setSellPremium(0);
    }
  }, [selectedSetId, accountSets]);

  useEffect(() => {
    // Set up WebSocket listeners for real-time updates
    const unsubscribeOpenOrders = onMessage('open_orders_update', (msg) => {
      // Support both shapes: {data:{...}} and {...}
      const payload = msg?.data ?? msg;
      const accountSetId = payload?.accountSetId;
      const orders = Array.isArray(payload?.orders) ? payload.orders : [];

      if (accountSetId !== selectedSetId) return;

      console.log('📈 Processing open_orders_update with orders:', orders.map(o => ({ 
        ticket: o.ticket, 
        brokerPosition: o.brokerPosition, 
        brokerId: o.brokerId,
        profit: o.profit 
      })));

      // Build a lookup with enhanced debugging:
      // Prefer <brokerId>:<ticket>, fallback to <brokerPosition>:<ticket>, then just <ticket>
      const byKey = new Map();
      for (const o of orders) {
        // Create multiple keys for flexible matching
        const keys = [];
        
        // Primary key: brokerId:ticket (most specific)
        if (o.brokerId) {
          keys.push(`${o.brokerId}:${o.ticket}`);
        }
        
        // Secondary key: brokerPosition:ticket (fallback)
        if (o.brokerPosition != null) {
          keys.push(`${o.brokerPosition}:${o.ticket}`);
        }
        
        // Tertiary key: just ticket (last resort)
        keys.push(String(o.ticket));
        
        // Store the order under all possible keys
        keys.forEach(key => byKey.set(key, o));
        
        // Debug log for each order's mapping
        console.log(`📋 Order ${o.ticket} mapped with keys:`, keys, 'from broker:', o.terminal, o.brokerName);
      }

      console.log('🔍 Order lookup keys created:', Array.from(byKey.keys()));
      console.log('🔍 Available orders:', orders.map(o => ({ 
        ticket: o.ticket, 
        brokerId: o.brokerId, 
        brokerPosition: o.brokerPosition 
      })));

      setActiveTrades(prev => {
        const updated = prev.map(t => {
          // Try multiple lookup strategies for broker1
          const o1Keys = [
            `${t.broker1Id}:${t.broker1Ticket}`,
            `1:${t.broker1Ticket}`,
            String(t.broker1Ticket)
          ];
          const o1 = o1Keys.map(key => byKey.get(key)).find(order => order);

          // Try multiple lookup strategies for broker2  
          const o2Keys = [
            `${t.broker2Id}:${t.broker2Ticket}`,
            `2:${t.broker2Ticket}`,
            String(t.broker2Ticket)
          ];
          const o2 = o2Keys.map(key => byKey.get(key)).find(order => order);

          // Enhanced debug logging for failed matches
          if (t.broker1Ticket && !o1) {
            console.warn(`🚫 Failed to match broker1 ticket ${t.broker1Ticket}:`);
            console.warn('  Tried keys:', o1Keys);
            console.warn('  Available orders:', orders.filter(ord => ord.ticket == t.broker1Ticket));
            console.warn('  Trade broker1Id:', t.broker1Id);
          }
          if (t.broker2Ticket && !o2) {
            console.warn(`🚫 Failed to match broker2 ticket ${t.broker2Ticket}:`);
            console.warn('  Tried keys:', o2Keys);
            console.warn('  Available orders:', orders.filter(ord => ord.ticket == t.broker2Ticket));
            console.warn('  Trade broker2Id:', t.broker2Id);
          }
          
          // Success logging when matches are found
          if (t.broker1Ticket && o1) {
            console.log(`✅ Matched broker1 ticket ${t.broker1Ticket} - Profit: ${o1.profit}`);
          }
          if (t.broker2Ticket && o2) {
            console.log(`✅ Matched broker2 ticket ${t.broker2Ticket} - Profit: ${o2.profit}`);
          }

          const p1 = Number(o1?.profit) || 0;
          const p2 = Number(o2?.profit) || 0;

          return { ...t, broker1Profit: p1, broker2Profit: p2, totalProfit: p1 + p2 };
        });
        setTotalPnL(updated.reduce((s, t) => s + (t.totalProfit || 0), 0));
        return updated;
      });
    });

    // Add balance message handler to prevent warnings
    const unsubscribeBalance = onMessage('balance', (data) => {
      console.log('📊 Received balance update:', data);
      // Handle balance updates if needed
    });

    // Add positions update handler for real-time profit updates
    const unsubscribePositions = onMessage('positions_update', (msg) => {
      const payload = msg?.data ?? msg;
      const accountSetId = payload?.accountSetId;
      
      if (accountSetId !== selectedSetId) return;
      
      console.log('📈 Processing positions_update:', payload);
      
      // Process MT4/MT5 position data to update profits
      const mt5Data = payload.mt5Data || [];
      const mt4Data = payload.mt4Data || [];
      
      console.log('📊 Position data received:', { mt5Count: mt5Data.length, mt4Count: mt4Data.length });
      
      // Update active trades with new profit data
      setActiveTrades(prev => {
        const updatedTrades = prev.map(trade => {
          let broker1Profit = trade.broker1Profit || 0;
          let broker2Profit = trade.broker2Profit || 0;
          
          // Find matching positions for this trade based on ticket numbers
          // We need to check both MT4 and MT5 data for each broker ticket
          
          // For broker1 ticket
          if (trade.broker1Ticket) {
            const mt5Match = mt5Data.find(pos => pos.ticket?.toString() === trade.broker1Ticket?.toString());
            const mt4Match = mt4Data.find(pos => pos.ticket?.toString() === trade.broker1Ticket?.toString());
            
            if (mt5Match) {
              broker1Profit = parseFloat(mt5Match.profit) || 0;
              console.log(`✅ Updated broker1 profit from MT5: ${trade.broker1Ticket} = ${broker1Profit}`);
            } else if (mt4Match) {
              broker1Profit = parseFloat(mt4Match.profit) || 0;
              console.log(`✅ Updated broker1 profit from MT4: ${trade.broker1Ticket} = ${broker1Profit}`);
            }
          }
          
          // For broker2 ticket
          if (trade.broker2Ticket) {
            const mt5Match = mt5Data.find(pos => pos.ticket?.toString() === trade.broker2Ticket?.toString());
            const mt4Match = mt4Data.find(pos => pos.ticket?.toString() === trade.broker2Ticket?.toString());
            
            if (mt5Match) {
              broker2Profit = parseFloat(mt5Match.profit) || 0;
              console.log(`✅ Updated broker2 profit from MT5: ${trade.broker2Ticket} = ${broker2Profit}`);
            } else if (mt4Match) {
              broker2Profit = parseFloat(mt4Match.profit) || 0;
              console.log(`✅ Updated broker2 profit from MT4: ${trade.broker2Ticket} = ${broker2Profit}`);
            }
          }
          
          const totalProfit = broker1Profit + broker2Profit;
          
          return {
            ...trade,
            broker1Profit,
            broker2Profit,
            totalProfit
          };
        });

        // Calculate and update total P&L
        const newTotal = updatedTrades.reduce((sum, trade) => sum + (trade.totalProfit || 0), 0);
        setTotalPnL(newTotal);

        return updatedTrades;
      });
    });

    return () => {
      unsubscribeOpenOrders();
      unsubscribeBalance();
      unsubscribePositions();
    };
  }, [selectedSetId]);

  // Premium calculation (same as Dashboard)
  useEffect(() => {
    if (futureQuote && spotQuote) {
      const newBuyPremium = (futureQuote.ask || 0) - (spotQuote.bid || 0);
      const newSellPremium = (futureQuote.bid || 0) - (spotQuote.ask || 0);
      
      setBuyPremium(newBuyPremium);
      setSellPremium(newSellPremium);
    } else {
      setBuyPremium(0);
      setSellPremium(0);
    }
  }, [futureQuote, spotQuote]);

  // WebSocket subscription for premium quotes (same pattern as Dashboard)
  useEffect(() => {
    const selectedAccountSet = accountSets.find(s => (s._id || s.id) === selectedSetId);
    
    if (!selectedAccountSet || !selectedSetId) {
      return;
    }

    // Only subscribe if symbols are locked (same as Dashboard logic)
    if (selectedAccountSet.symbolsLocked && selectedAccountSet.futureSymbol && selectedAccountSet.spotSymbol) {
      console.log('📡 ActiveTrades: Subscribing to quotes for premium display:', { 
        futureSymbol: selectedAccountSet.futureSymbol, 
        spotSymbol: selectedAccountSet.spotSymbol 
      });

      // Connect to WebSocket and subscribe to quotes
      connectWS(selectedSetId);

      const handleQuoteUpdate = (data) => {
        console.log('📈 ActiveTrades: Quote update received:', data);
        
        if (data.futureSymbol === selectedAccountSet.futureSymbol && data.futureQuote) {
          setFutureQuote(data.futureQuote);
        }
        if (data.spotSymbol === selectedAccountSet.spotSymbol && data.spotQuote) {
          setSpotQuote(data.spotQuote);
        }
      };

      subscribeToQuotes(selectedSetId, selectedAccountSet.futureSymbol, selectedAccountSet.spotSymbol, handleQuoteUpdate);
      
      const unsubscribeQuotes = onMessage('quote_update', handleQuoteUpdate);

      return () => {
        unsubscribeQuotes();
      };
    } else {
      console.log('🚫 ActiveTrades: Skipping quote subscription - symbols not locked');
    }
  }, [selectedSetId, accountSets]);

  // Helper function to get current premium based on broker1 direction
  const getCurrentPremiumForTrade = (trade) => {
    if (!buyPremium && !sellPremium) {
      // Fallback to stored currentPremium if no real-time data
      return (parseFloat(trade.currentPremium) || 0).toFixed(2);
    }
    
    // Apply your logic: if broker1 direction is "sell" → show buy premium, if "buy" → show sell premium
    const broker1Direction = (trade.broker1Direction || '').toLowerCase();
    
    if (broker1Direction === 'sell') {
      return buyPremium.toFixed(2);
    } else if (broker1Direction === 'buy') {
      return sellPremium.toFixed(2);
    } else {
      // Fallback if direction is unclear
      return (parseFloat(trade.currentPremium) || 0).toFixed(2);
    }
  };

  const loadAccountSets = async () => {
    try {
      const res = await API.get('/account-sets');
      // console.log('Account sets API response:', res.data);
      
      const accountSetsData = res.data.data || res.data;
      if (Array.isArray(accountSetsData)) {
        setAccountSets(accountSetsData);
        if (accountSetsData.length > 0) {
          const selectedId = accountSetsData[0]._id || accountSetsData[0].id;
          // console.log('Setting selected account set ID:', selectedId);
          setSelectedSetId(selectedId);
        }
      } else {
        console.error('Account sets data is not an array:', accountSetsData);
      }
    } catch (err) {
      console.error('Failed to load account sets:', err);
    }
  };

  const loadActiveTrades = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const res = await API.get(`/trading/active-trades?accountSetId=${selectedSetId}`);
      // console.log('Active trades API response:', res.data);
      
      if (res.data.success) {
        const trades = res.data.trades || [];
        // console.log('Setting active trades:', trades);
        // console.log('Number of trades:', trades.length);
        
        // Initialize trades with profit values (will be updated by WebSocket)
        const tradesWithProfits = trades.map(trade => ({
          ...trade,
          broker1Profit: trade.broker1Profit || 0,
          broker2Profit: trade.broker2Profit || 0,
          totalProfit: (trade.broker1Profit || 0) + (trade.broker2Profit || 0)
        }));
        
        setActiveTrades(tradesWithProfits);
        
        // Calculate initial P&L
        const initialPnL = tradesWithProfits.reduce((sum, trade) => sum + (trade.totalProfit || 0), 0);
        setTotalPnL(initialPnL);
      } else {
        console.error('Failed to load active trades:', res.data.message);
        setActiveTrades([]);
      }
    } catch (err) {
      console.error('Failed to load active trades:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const saveTPValue = async (tradeId, newTPValue) => {
    try {
      setSavingTP(prev => new Set(prev).add(tradeId));
      
      // Call API to update TP value
      const res = await API.put(`/trading/update-tp`, {
        tradeId,
        takeProfit: newTPValue
      });
      
      if (res.data.success) {
        // Update local state
        setActiveTrades(prev => prev.map(trade => 
          trade.tradeId === tradeId 
            ? { ...trade, takeProfit: newTPValue }
            : trade
        ));
        
        // Clear editing state
        setEditingTP(prev => ({ ...prev, [tradeId]: false }));
        setTpValues(prev => ({ ...prev, [tradeId]: '' }));
      } else {
        alert('Failed to update TP: ' + (res.data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to save TP:', err);
      alert('Failed to save TP: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingTP(prev => {
        const newSet = new Set(prev);
        newSet.delete(tradeId);
        return newSet;
      });
    }
  };

  const startEditingTP = (tradeId, currentTP) => {
    setEditingTP(prev => ({ ...prev, [tradeId]: true }));
    setTpValues(prev => ({ ...prev, [tradeId]: currentTP || '' }));
  };

  const cancelEditingTP = (tradeId) => {
    setEditingTP(prev => ({ ...prev, [tradeId]: false }));
    setTpValues(prev => ({ ...prev, [tradeId]: '' }));
  };

  const closeTrade = async (trade) => {
    try {
      // Add this trade to closing set
      setClosingTrades(prev => new Set(prev).add(trade.tradeId));
      
      // Get broker information
      if (!selectedAccountSet || !selectedAccountSet.brokers) {
        throw new Error('Account set or brokers not available');
      }
      
      const broker1 = selectedAccountSet.brokers.find(b => b.id === trade.broker1Id);
      const broker2 = selectedAccountSet.brokers.find(b => b.id === trade.broker2Id);
      
      if (!broker1 || !broker2) {
        throw new Error('Required brokers not found in account set');
      }
      
      const closeResults = [];
      
      // Close Broker 1 trade if it exists
      if (trade.broker1Ticket && broker1) {
        try {
          const broker1ApiUrl = broker1.terminal === 'MT4' ? 'https://mt4.premiumprofit.live' : 'https://mt5.premiumprofit.live';
          const broker1CloseUrl = `${broker1ApiUrl}/OrderClose?id=${broker1.externalApiId}&ticket=${trade.broker1Ticket}&lots=${trade.broker1Volume}&price=0&slippage=0`;
          
          const broker1Response = await fetch(broker1CloseUrl);
          const broker1Data = await broker1Response.json();
          
          closeResults.push({
            broker: 'Broker 1',
            success: true,
            data: broker1Data,
            ticket: trade.broker1Ticket
          });
        } catch (error) {
          closeResults.push({
            broker: 'Broker 1',
            success: false,
            error: error.message,
            ticket: trade.broker1Ticket
          });
        }
      }
      
      // Close Broker 2 trade if it exists
      if (trade.broker2Ticket && broker2) {
        try {
          const broker2ApiUrl = broker2.terminal === 'MT4' ? 'https://mt4.premiumprofit.live' : 'https://mt5.premiumprofit.live';
          const broker2CloseUrl = `${broker2ApiUrl}/OrderClose?id=${broker2.externalApiId}&ticket=${trade.broker2Ticket}&lots=${trade.broker2Volume}&price=0&slippage=0`;
          
          const broker2Response = await fetch(broker2CloseUrl);
          const broker2Data = await broker2Response.json();
          
          closeResults.push({
            broker: 'Broker 2',
            success: true,
            data: broker2Data,
            ticket: trade.broker2Ticket
          });
        } catch (error) {
          closeResults.push({
            broker: 'Broker 2',
            success: false,
            error: error.message,
            ticket: trade.broker2Ticket
          });
        }
      }
      
      // Now call the backend to mark trade as closed and create closed trade record
      const res = await API.post('/trading/close-trade-external', {
        tradeId: trade.tradeId,
        closeResults,
        reason: 'Manual'
      });
      
      if (res.data.success) {
        loadActiveTrades();
        
        const successCount = closeResults.filter(r => r.success).length;
        const totalCount = closeResults.length;
        
        if (successCount === totalCount) {
          alert(`Trade closed successfully! Closed ${successCount} positions.`);
        } else {
          alert(`Partially closed: ${successCount}/${totalCount} positions closed successfully.`);
        }
      }
    } catch (err) {
      console.error('Failed to close trade:', err);
      alert('Failed to close trade: ' + (err.message || 'Unknown error'));
    } finally {
      // Remove this trade from closing set
      setClosingTrades(prev => {
        const newSet = new Set(prev);
        newSet.delete(trade.tradeId);
        return newSet;
      });
    }
  };

  const selectedAccountSet = accountSets.find(s => (s._id || s.id) === selectedSetId);
  
  // Debug logging (can be removed in production)
  // console.log('Selected account set:', selectedAccountSet);
  // console.log('Account sets:', accountSets);  
  // console.log('Selected set ID:', selectedSetId);
  // console.log('Active trades state:', activeTrades);
  // console.log('Active trades length:', activeTrades.length);

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #1e3c72, #2a5298)', 
      minHeight: '100vh', 
      padding: '2rem',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          marginBottom: '0.5rem',
          color: '#4fc3f7'
        }}>
          Active Trades
        </h1>
        <p style={{ 
          color: '#b0bec5', 
          marginBottom: '2rem',
          fontSize: '1.1rem'
        }}>
          Monitor your active trading positions
        </p>

        {/* Account Set Selector */}
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            fontSize: '1.1rem',
            fontWeight: 'bold'
          }}>
            Account Set:
            <select
              value={selectedSetId}
              onChange={e => setSelectedSetId(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                minWidth: '300px',
                fontSize: '1rem',
                background: 'white',
                color: '#333'
              }}
            >
              {accountSets.map(set => (
                <option key={set._id || set.id} value={set._id || set.id}>
                  {set.name}
                </option>
              ))}
            </select>
          </label>
          {selectedAccountSet && (
            <div style={{ 
              marginTop: '12px', 
              fontSize: '0.95rem', 
              color: '#e3f2fd'
            }}>
              <span>
                {selectedAccountSet.brokers?.map((broker, index) => 
                  `Broker ${broker.position || index + 1}: ${broker.terminal} (${broker.brokerName || broker.accountNumber})`
                ).join(' • ')}
              </span>
              <div style={{ marginTop: '8px', fontSize: '0.85rem', opacity: 0.8 }}>
                Terminal Combination: {selectedAccountSet.brokers?.[0]?.terminal}-{selectedAccountSet.brokers?.[1]?.terminal}
              </div>
            </div>
          )}
        </div>

        {/* Active Trades Monitor */}
        <div style={{
          background: 'linear-gradient(135deg, #43a047, #66bb6a)',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '1rem'
        }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>
            Active Trades Monitor
            {selectedAccountSet && (
              <span style={{ fontSize: '0.9rem', opacity: 0.9, marginLeft: '1rem' }}>
                ({selectedAccountSet.brokers?.[0]?.terminal}-{selectedAccountSet.brokers?.[1]?.terminal})
              </span>
            )}
          </h2>
          <p style={{ margin: 0, fontSize: '1rem' }}>
            Total: {activeTrades.length} trades • Platform-executed trades only • Real-time via WebSocket
          </p>
        </div>

        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px'
          }}>
            Loading active trades...
          </div>
        ) : (
          <>

            {/* Data Table */}
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem'
              }}>
                <thead style={{
                  background: 'linear-gradient(135deg, #43a047, #66bb6a)',
                  color: 'white'
                }}>
                  <tr>
                    <th style={tableHeaderStyle}>Broker1<br/>({selectedAccountSet?.brokers?.[0]?.terminal || 'MT4'})</th>
                    <th style={tableHeaderStyle}>Broker2<br/>({selectedAccountSet?.brokers?.[1]?.terminal || 'MT5'})</th>
                    <th style={tableHeaderStyle}>Direction</th>
                    <th style={tableHeaderStyle}>Lot<br/>Size</th>
                    <th style={tableHeaderStyle}>Broker1<br/>Profit</th>
                    <th style={tableHeaderStyle}>Broker2<br/>Profit</th>
                    <th style={tableHeaderStyle}>Opening<br/>Premium</th>
                    <th style={tableHeaderStyle}>Current<br/>Premium</th>
                    <th style={tableHeaderStyle}>Deficit<br/>Premium</th>
                    <th style={tableHeaderStyle}>Swap</th>
                    <th style={tableHeaderStyle}>Current<br/>Profit</th>
                    <th style={tableHeaderStyle}>TP</th>
                    <th style={tableHeaderStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTrades.map((trade, index) => (
                    <tr key={trade.tradeId} style={{
                      background: index % 2 === 0 ? 'white' : '#f8f9fa',
                      color: '#333'
                    }}>
                      {/* Broker1 (MT4) */}
                      <td style={tableCellStyle}>
                        <span style={{ fontWeight: 'bold' }}>{trade.broker1Ticket}</span>
                      </td>
                      {/* Broker2 (MT4) */}
                      <td style={tableCellStyle}>
                        <span style={{ fontWeight: 'bold' }}>{trade.broker2Ticket || 'N/A'}</span>
                      </td>
                      {/* Direction */}
                      <td style={tableCellStyle}>
                        <span style={{
                          background: '#ffebee',
                          color: '#c62828',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold'
                        }}>
                          {trade.broker1Direction || 'N/A'}/{trade.broker2Direction || 'N/A'}
                        </span>
                      </td>
                      {/* Lot Size */}
                      <td style={tableCellStyle}>{trade.broker1Volume}</td>
                      {/* Broker1 Profit */}
                      <td style={{ 
                        ...tableCellStyle, 
                        fontWeight:'bold',
                        color: trade.broker1Profit >= 0 ? '#4caf50' : '#f44336'
                      }}>
                        {money(trade.broker1Profit || 0)}
                      </td>
                      {/* Broker2 Profit */}
                      <td style={{ 
                        ...tableCellStyle, 
                        fontWeight:'bold',
                        color: trade.broker2Profit >= 0 ? '#4caf50' : '#f44336'
                      }}>
                        {money(trade.broker2Profit || 0)}
                      </td>
                      {/* Opening Premium */}
                      <td style={tableCellStyle}>{(parseFloat(trade.executionPremium) || 0).toFixed(2)}</td>
                      {/* Current Premium */}
                      <td style={tableCellStyle}>{getCurrentPremiumForTrade(trade)}</td>
                      {/* Deficit Premium */}
                      <td style={{
                        ...tableCellStyle,
                        color: ((parseFloat(trade.executionPremium) || 0) - parseFloat(getCurrentPremiumForTrade(trade))) >= 0 ? '#4caf50' : '#f44336',
                        fontWeight: 'bold'
                      }}>
                        {((parseFloat(trade.executionPremium) || 0) - parseFloat(getCurrentPremiumForTrade(trade))).toFixed(2)}
                      </td>
                      {/* Swap */}
                      <td style={{ 
                        ...tableCellStyle,
                        color: (trade.swap || 0) >= 0 ? '#4caf50' : '#f44336'
                      }}>
                        {money(trade.swap || 0)}
                      </td>
                      {/* Current Profit */}
                      <td style={{ 
                        ...tableCellStyle, 
                        fontWeight:'bold', 
                        fontSize:'1.1rem',
                        color: trade.totalProfit >= 0 ? '#4caf50' : '#f44336'
                      }}>
                        {money(trade.totalProfit)}
                      </td>
                      {/* TP */}
                      <td style={tableCellStyle}>
                        {editingTP[trade.tradeId] ? (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input
                              type="number"
                              step="0.00001"
                              value={tpValues[trade.tradeId] || ''}
                              onChange={(e) => setTpValues(prev => ({ ...prev, [trade.tradeId]: e.target.value }))}
                              style={{
                                width: '80px',
                                padding: '4px 6px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '0.8rem'
                              }}
                              placeholder="Enter TP"
                              autoFocus
                            />
                            <button
                              onClick={() => saveTPValue(trade.tradeId, tpValues[trade.tradeId])}
                              disabled={savingTP.has(trade.tradeId)}
                              style={{
                                background: '#4caf50',
                                color: 'white',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                cursor: savingTP.has(trade.tradeId) ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {savingTP.has(trade.tradeId) ? '...' : '✓'}
                            </button>
                            <button
                              onClick={() => cancelEditingTP(trade.tradeId)}
                              style={{
                                background: '#f44336',
                                color: 'white',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                cursor: 'pointer'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => startEditingTP(trade.tradeId, trade.takeProfit)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              background: '#e3f2fd',
                              border: '1px solid transparent',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.target.style.background = '#bbdefb';
                              e.target.style.border = '1px solid #1976d2';
                            }}
                            onMouseOut={(e) => {
                              e.target.style.background = '#e3f2fd';
                              e.target.style.border = '1px solid transparent';
                            }}
                          >
                            <span style={{
                              color: '#1976d2',
                              fontSize: '0.8rem',
                              fontWeight: 'bold'
                            }}>
                              {trade.takeProfit || 'Set TP'}
                            </span>
                            <span style={{ color: '#1976d2', fontSize: '0.7rem' }}>✏️</span>
                          </div>
                        )}
                      </td>
                      {/* Action */}
                      <td style={tableCellStyle}>
                        <button
                          onClick={() => closeTrade(trade)}
                          disabled={closingTrades.has(trade.tradeId)}
                          style={{
                            background: closingTrades.has(trade.tradeId) ? '#ccc' : '#f44336',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            cursor: closingTrades.has(trade.tradeId) ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          {closingTrades.has(trade.tradeId) ? '⏳' : '✕'}
                        </button>
                        <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>
                          {closingTrades.has(trade.tradeId) ? '' : 'Close'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {activeTrades.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: '#666'
                }}>
                  No platform-executed trades found
                </div>
              )}
            </div>

            {/* Total P&L */}
            <div style={{
              background: 'linear-gradient(135deg, #26a69a, #4db6ac)',
              padding: '1rem 2rem',
              borderRadius: '0 0 12px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '1.2rem',
              fontWeight: 'bold'
            }}>
              <span>Total P&L: ${totalPnL.toFixed(2)}</span>
              <div style={{ display: 'flex', gap: '2rem', fontSize: '1rem' }}>
                <span>Active Trades: {activeTrades.length}</span>
                <span>Complete Pairs: {activeTrades.filter(t => t.broker1Ticket && t.broker2Ticket).length}</span>
                <span>Partial Trades: {activeTrades.filter(t => t.status === 'PartiallyFilled').length}</span>
                <span>Full Pairs: {activeTrades.filter(t => t.status === 'Active').length}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const tableHeaderStyle = {
  padding: '12px 8px',
  textAlign: 'left',
  fontWeight: 'bold',
  fontSize: '0.85rem',
  borderBottom: '2px solid rgba(255,255,255,0.3)',
  color: 'white'
};

const tableCellStyle = {
  padding: '12px 8px',
  borderBottom: '1px solid #e0e0e0',
  fontSize: '0.9rem'
};