// src/pages/ActiveTrades.jsx

import React, { useState, useEffect } from 'react';
import API from '../services/api';
import mt4mt5Service from '../services/mt4mt5Service';
import { onMessage, subscribeToPremium, subscribeToPositions, connectWS } from '../services/wsService';
import './ActiveTrades.css';

export default function ActiveTrades() {
  const [accountSets, setAccountSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [activeTrades, setActiveTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [mt4mt5Data, setMT4MT5Data] = useState({});
  const [premiumData, setPremiumData] = useState({});

  // Fetch active trades for selected account set
  const fetchActiveTrades = async (accountSetId) => {
    if (!accountSetId) return;
    
    setTradesLoading(true);
    try {
      const params = accountSetId ? { accountSetId } : {};
      const res = await API.get('/trading/active-trades', { params });
      const trades = res.data.trades || [];
      setActiveTrades(trades);
    } catch (error) {
      console.error('Error fetching active trades:', error);
      setActiveTrades([]);
    }
    setTradesLoading(false);
  };

  useEffect(() => {
    // Initialize WebSocket connection first
    console.log('🔌 Initializing WebSocket connection...');
    
    API.get('/account-sets')
      .then(res => {
        const accountSetsData = res.data.data || res.data;
        if (Array.isArray(accountSetsData)) {
          setAccountSets(accountSetsData);
          if (accountSetsData.length > 0) {
            const firstSetId = accountSetsData[0]._id || accountSetsData[0].id;
            setSelectedSetId(firstSetId);
            fetchActiveTrades(firstSetId);
            
            // Initialize WebSocket connection with first account set
            connectWS(firstSetId);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setAccountSets([]);
        setLoading(false);
      });

    // Subscribe to MT4/MT5 data updates
    const unsubscribeMT4MT5 = mt4mt5Service.subscribe((data) => {
      console.log('🔄 MT4/MT5 Service data update:', data);
      setMT4MT5Data(data.dataCache || {});
      setPremiumData(data.premiumData || {});
      
      // Force re-render to update profits
      setActiveTrades(prevTrades => [...prevTrades]);
    });

    // Subscribe to trade status updates for real-time notifications
    const unsubscribeTradeStatus = onMessage('trade_status_update', (data) => {
      console.log('🔄 Trade status update received:', data);
      if (data.status === 'closed' && data.accountSetId === selectedSetId) {
        // Refresh active trades when a trade is closed
        fetchActiveTrades(selectedSetId);
        
        // Show notification to user
        alert(`Trade ${data.tradeId} has been closed: ${data.reason}`);
      }
    });

    // Subscribe to error messages
    const unsubscribeError = onMessage('error', (data) => {
      console.error('❌ WebSocket error received:', data);
      // Handle errors gracefully without showing alerts for every error
      if (data.message && !data.message.includes('temporarily unavailable')) {
        console.warn('WebSocket Error:', data.message);
      }
    });

    // Subscribe to balance messages (to prevent warnings)
    const unsubscribeBalance = onMessage('balance', (data) => {
      console.log('💰 Balance update received:', data);
      // Balance updates are handled by other components, just acknowledge here
    });

    // Cleanup on component unmount
    return () => {
      unsubscribeMT4MT5();
      unsubscribeTradeStatus();
      unsubscribeError();
      unsubscribeBalance();
      mt4mt5Service.disconnect();
    };
  }, []);

  // Fetch active trades when account set changes
  useEffect(() => {
    if (selectedSetId) {
      fetchActiveTrades(selectedSetId);
      
      // Initialize MT4/MT5 service for this account set
      mt4mt5Service.initializeAccountSet(selectedSetId);
      
      // Subscribe to premium and positions updates for this account set
      const accountSet = accountSets.find(set => (set._id || set.id) === selectedSetId);
      if (accountSet) {
        subscribeToPremium(selectedSetId, accountSet.futureSymbol, accountSet.spotSymbol);
        subscribeToPositions(selectedSetId);
      }
    }
  }, [selectedSetId, accountSets]);

  // Handle close trade
  const handleCloseTrade = async (tradeId) => {
    if (!window.confirm('Are you sure you want to close this trade?')) return;
    
    try {
      await API.post('/trading/close-trade', { tradeId });
      // Refresh trades after closing
      fetchActiveTrades(selectedSetId);
      alert('Trade closed successfully');
    } catch (error) {
      console.error('Error closing trade:', error);
      alert('Failed to close trade: ' + (error.response?.data?.message || error.message));
    }
  };

  // Handle manual sync of trade statuses
  const handleSyncTradeStatus = async () => {
    try {
      setTradesLoading(true);
      await API.post('/trading/sync-trade-status');
      // Refresh trades after sync
      await fetchActiveTrades(selectedSetId);
      alert('Trade status sync completed');
    } catch (error) {
      console.error('Error syncing trade status:', error);
      alert('Failed to sync trade status: ' + (error.response?.data?.message || error.message));
    } finally {
      setTradesLoading(false);
    }
  };

  // Handle manual database cleanup
  const handleCleanupDatabase = async () => {
    if (!window.confirm('Are you sure you want to clean up stale database records? This will move closed trades from active_trades to closed_trades table.')) return;
    
    try {
      setTradesLoading(true);
      await API.post('/trading/cleanup-database');
      // Refresh trades after cleanup
      await fetchActiveTrades(selectedSetId);
      alert('Database cleanup completed successfully');
    } catch (error) {
      console.error('Error cleaning up database:', error);
      alert('Failed to cleanup database: ' + (error.response?.data?.message || error.message));
    } finally {
      setTradesLoading(false);
    }
  };

  if (loading) return <p>Loading...</p>;

  const selectedAccountSet = accountSets.find(s => s._id === selectedSetId);

  return (
    <div className="active-trades-page">
      <div className="page-header">
        <h1>Active Trades</h1>
        <p>Monitor your active trading positions</p>
      </div>

      {/* Account Set Filter */}
      {accountSets.length > 0 && (
        <div className="account-filter">
          <label>
            <strong>Account Set:</strong>
            <select
              value={selectedSetId}
              onChange={e => setSelectedSetId(e.target.value)}
              className="account-select"
            >
              {accountSets.map(set => (
                <option key={set._id} value={set._id}>
                  {set.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Active Trades Table */}
      <div className="trades-container">
        <div className="trades-header">
          <div className="header-controls">
            <div className="trade-filter">
              <label>
                <input type="radio" name="filter" value="all" defaultChecked />
                CURRENT_PROFIT
              </label>
              <label>
                <input type="radio" name="filter" value="deficit" />
                DEFICIT_PREMIUM
              </label>
            </div>
            
            {/* Data Status Indicator */}
            <div className="data-status" style={{ marginLeft: '20px', fontSize: '12px' }}>
              <div style={{ color: mt4mt5Data[selectedSetId] ? 'green' : 'red' }}>
                📡 Live Data: {mt4mt5Data[selectedSetId] ? 'Connected' : 'Disconnected'}
              </div>
              <div style={{ color: premiumData[selectedSetId] ? 'green' : 'red' }}>
                💰 Premium: {premiumData[selectedSetId] ? 'Live' : 'No Data'}
              </div>
            </div>
            
            <button 
              className="sync-button"
              onClick={handleSyncTradeStatus}
              disabled={tradesLoading}
              style={{ 
                marginLeft: '10px', 
                padding: '8px 16px', 
                backgroundColor: '#4CAF50', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: tradesLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {tradesLoading ? '🔄 Syncing...' : '🔄 Sync Status'}
            </button>

            <button 
              className="cleanup-button"
              onClick={handleCleanupDatabase}
              disabled={tradesLoading}
              style={{ 
                marginLeft: '10px', 
                padding: '8px 16px', 
                backgroundColor: '#FF9800', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: tradesLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {tradesLoading ? '🧹 Cleaning...' : '🧹 Cleanup DB'}
            </button>

          </div>
        </div>

        <table className="active-trades-table">
          <thead>
            <tr>
              <th>MT5 Ticket</th>
              <th>MT4 Ticket</th>
              <th>Lot Size</th>
              <th>MT5 Profit</th>
              <th>MT4 Profit</th>
              <th>Opening Premium</th>
              <th>Cr Premium</th>
              <th>Deficit Premium</th>
              <th>Swap</th>
              <th>Current Profit</th>
              <th>TP</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tradesLoading ? (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', padding: '20px' }}>
                  Loading trades...
                </td>
              </tr>
            ) : activeTrades.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', padding: '20px' }}>
                  No active trades found
                </td>
              </tr>
            ) : (
              (() => {
                console.log('🔍 RENDER: Starting trade filtering process');
                console.log('🔍 RENDER: Total trades from database:', activeTrades.length);
                console.log('🔍 RENDER: Selected account set:', selectedSetId);
                console.log('🔍 RENDER: MT4/MT5 cache status:', { cacheKeys: Object.keys(mt4mt5Data), selectedCache: !!mt4mt5Data[selectedSetId] });
                
                // Filter trades to show only active ones for the selected account set
                const filteredTrades = activeTrades.filter((trade) => {
                  // Only show trades that match the selected account set and are actually active
                  return trade.accountSetId === selectedSetId && trade.status === 'Active';
                });
                
                console.log('🔍 RENDER: Filtered trades for display:', filteredTrades.length);
                
                return filteredTrades.map((trade) => {
                // Determine which broker is MT5 and which is MT4
                const mt5Ticket = trade.broker1?.terminal === 'MT5' ? 
                  trade.broker1Ticket : trade.broker2Ticket;
                const mt4Ticket = trade.broker1?.terminal === 'MT4' ? 
                  trade.broker1Ticket : trade.broker2Ticket;

                // Get profit data using new service
                const profitData = mt4mt5Service.calculateTradeProfit(selectedSetId, mt5Ticket, mt4Ticket);

                // Get premium data using new service  
                const premiumCalc = mt4mt5Service.calculatePremiumData(
                  selectedSetId, 
                  trade.broker1Direction, // Use the direction from the trade
                  trade.executionPremium
                );

                const { 
                  mt5Profit = 0, 
                  mt4Profit = 0, 
                  totalSwap = 0, 
                  totalProfit = 0 
                } = profitData || {};

                const { 
                  currentPremium = 0, 
                  deficitPremium = 0 
                } = premiumCalc || {};

                // Debug logging to understand what data we're getting
                if (profitData && (mt5Profit !== 0 || mt4Profit !== 0)) {
                  console.log('✅ Live profit data available:', { 
                    tradeId: trade.tradeId,
                    mt5Ticket, 
                    mt4Ticket, 
                    mt5Profit, 
                    mt4Profit, 
                    totalProfit 
                  });
                } else {
                  console.log('⚠️ No live profit data for trade:', { 
                    tradeId: trade.tradeId,
                    mt5Ticket, 
                    mt4Ticket,
                    hasCacheData: !!mt4mt5Data[selectedSetId],
                    profitData
                  });
                }

                return (
                  <tr key={trade.tradeId}>
                    <td>{mt5Ticket}</td>
                    <td>{mt4Ticket}</td>
                    <td>{trade.broker1Volume}</td>
                    <td style={{ color: profitData ? 'inherit' : 'red' }}>
                      {profitData ? mt5Profit.toFixed(2) : 'No Data'}
                    </td>
                    <td style={{ color: profitData ? 'inherit' : 'red' }}>
                      {profitData ? mt4Profit.toFixed(2) : 'No Data'}
                    </td>
                    <td>{parseFloat(trade.executionPremium).toFixed(2)}</td>
                    <td style={{ color: premiumCalc ? 'inherit' : 'red' }}>
                      {premiumCalc ? currentPremium.toFixed(2) : 'No Data'}
                    </td>
                    <td style={{ color: premiumCalc ? 'inherit' : 'red' }}>
                      {premiumCalc ? deficitPremium.toFixed(2) : 'No Data'}
                    </td>
                    <td style={{ color: profitData ? 'inherit' : 'red' }}>
                      {profitData ? totalSwap.toFixed(2) : 'No Data'}
                    </td>
                    <td style={{ color: profitData ? 'inherit' : 'red' }}>
                      {profitData ? totalProfit.toFixed(2) : 'No Data'}
                    </td>
                    <td>
                      <div className="tp-edit">
                        <input 
                          type="number" 
                          className="tp-input" 
                          placeholder={trade.takeProfit || "900"} 
                        />
                        <button className="save-tp-btn">💾</button>
                      </div>
                    </td>
                    <td>
                      <button 
                        className="close-btn"
                        onClick={() => handleCloseTrade(trade.tradeId)}
                      >
                        × Close
                      </button>
                    </td>
                  </tr>
                );
              });
              })()
            )}
          </tbody>
        </table>

        <div className="table-footer">
          <div className="grand-total">
            <strong>Grand Total: ${activeTrades
              .filter(trade => trade.accountSetId === selectedSetId && trade.status === 'Active')
              .reduce((total, trade) => {
                const mt5Ticket = trade.broker1?.terminal === 'MT5' ? 
                  trade.broker1Ticket : trade.broker2Ticket;
                const mt4Ticket = trade.broker1?.terminal === 'MT4' ? 
                  trade.broker1Ticket : trade.broker2Ticket;

                const profitData = mt4mt5Service.calculateTradeProfit(selectedSetId, mt5Ticket, mt4Ticket);
                return total + profitData.totalProfit;
              }, 0).toFixed(2)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}