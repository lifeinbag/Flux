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
      <div className="trades-container" style={{ marginTop: '20px' }}>
        <div className="table-header" style={{ 
          background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', 
          color: 'white', 
          padding: '15px 20px', 
          borderRadius: '10px 10px 0 0',
          marginBottom: '0'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Active Trades Monitor</h3>
          <span style={{ fontSize: '14px', opacity: 0.9 }}>
            Total: {activeTrades.filter(trade => trade.accountSetId === selectedSetId && (trade.status === 'Active' || trade.status === 'Partial')).length} trades
          </span>
        </div>
        
        <div style={{ overflowX: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius: '0 0 10px 10px' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            fontSize: '13px',
            backgroundColor: 'white'
          }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>MT5 Ticket</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>MT4 Ticket</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Direction</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Lot Size</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>MT5 Profit</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>MT4 Profit</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Opening Premium</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Current Premium</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Deficit Premium</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Swap</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Current Profit</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>TP</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tradesLoading ? (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <div style={{ width: '20px', height: '20px', border: '3px solid #f3f3f3', borderTop: '3px solid #28a745', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    Loading active trades...
                  </div>
                </td>
              </tr>
            ) : activeTrades.filter(trade => trade.accountSetId === selectedSetId && (trade.status === 'Active' || trade.status === 'Partial')).length === 0 ? (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                  <div style={{ fontSize: '16px' }}>📈 No active trades found</div>
                  <div style={{ fontSize: '12px', marginTop: '5px' }}>Active positions will appear here when you execute trades</div>
                </td>
              </tr>
            ) : (
              (() => {
                console.log('🔍 RENDER: Starting trade filtering process');
                console.log('🔍 RENDER: Total trades from database:', activeTrades.length);
                console.log('🔍 RENDER: Selected account set:', selectedSetId);
                console.log('🔍 RENDER: MT4/MT5 cache status:', { cacheKeys: Object.keys(mt4mt5Data), selectedCache: !!mt4mt5Data[selectedSetId] });
                
                // Filter trades to show active and partial trades for the selected account set
                const filteredTrades = activeTrades.filter((trade) => {
                  // Show trades that match the selected account set and are active or partial
                  return trade.accountSetId === selectedSetId && (trade.status === 'Active' || trade.status === 'Partial');
                });
                
                console.log('🔍 RENDER: Filtered trades for display:', filteredTrades.length);
                
                return filteredTrades.map((trade) => {
                // Handle partial trades - some broker data might be null
                const broker1Data = trade.broker1 || {};
                const broker2Data = trade.broker2 || {};
                
                // Determine which broker is MT5 and which is MT4 (handle partial trades)
                const mt5Ticket = (broker1Data.terminal === 'MT5' && trade.broker1Ticket) ? 
                  trade.broker1Ticket : 
                  (broker2Data.terminal === 'MT5' && trade.broker2Ticket) ? 
                  trade.broker2Ticket : null;
                  
                const mt4Ticket = (broker1Data.terminal === 'MT4' && trade.broker1Ticket) ? 
                  trade.broker1Ticket : 
                  (broker2Data.terminal === 'MT4' && trade.broker2Ticket) ? 
                  trade.broker2Ticket : null;

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

                const rowIndex = filteredTrades.indexOf(trade);
                return (
                  <tr key={trade.tradeId} style={{ 
                    backgroundColor: trade.status === 'Partial' ? '#fff3cd' : rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa',
                    borderBottom: '1px solid #dee2e6',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={e => e.target.parentElement.style.backgroundColor = '#e3f2fd'}
                  onMouseLeave={e => e.target.parentElement.style.backgroundColor = trade.status === 'Partial' ? '#fff3cd' : rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa'}
                  >
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', fontFamily: 'monospace' }}>
                      <span title={`Comment: ${trade.comment || 'N/A'}`}>
                        {mt5Ticket || <em style={{color: '#999'}}>No MT5</em>}
                      </span>
                      {trade.status === 'Partial' && <div style={{fontSize: '10px', color: '#856404', fontWeight: '600'}}>[PARTIAL]</div>}
                    </td>
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', fontFamily: 'monospace' }}>
                      <span title={`Status: ${trade.status}`}>
                        {mt4Ticket || <em style={{color: '#999'}}>No MT4</em>}
                      </span>
                      {trade.status === 'Partial' && <div style={{fontSize: '10px', color: '#856404', fontWeight: '600'}}>[PARTIAL]</div>}
                    </td>
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6' }}>
                      <span style={{ 
                        color: trade.broker1Direction === 'Buy' ? '#28a745' : '#dc3545',
                        fontWeight: '600',
                        fontSize: '12px',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: trade.broker1Direction === 'Buy' ? '#d4edda' : '#f8d7da'
                      }}>
                        {trade.broker1Direction ? 
                          `${trade.broker1Direction}/${trade.broker1Direction === 'Buy' ? 'Sell' : 'Buy'}` :
                          trade.broker2Direction ? 
                            `${trade.broker2Direction === 'Buy' ? 'Sell' : 'Buy'}/${trade.broker2Direction}` :
                            'N/A'
                        }
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', textAlign: 'center' }}>
                      {trade.broker1Volume || trade.broker2Volume || 'N/A'}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      color: profitData ? (mt5Profit >= 0 ? '#28a745' : '#dc3545') : '#dc3545',
                      fontWeight: '600',
                      textAlign: 'right'
                    }}>
                      {profitData ? `$${mt5Profit.toFixed(2)}` : 'No Data'}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      color: profitData ? (mt4Profit >= 0 ? '#28a745' : '#dc3545') : '#dc3545',
                      fontWeight: '600',
                      textAlign: 'right'
                    }}>
                      {profitData ? `$${mt4Profit.toFixed(2)}` : 'No Data'}
                    </td>
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', textAlign: 'right' }}>
                      {parseFloat(trade.executionPremium).toFixed(5)}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      textAlign: 'right',
                      color: premiumCalc ? 'inherit' : '#dc3545'
                    }}>
                      {premiumCalc ? currentPremium.toFixed(5) : 'No Data'}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      textAlign: 'right',
                      color: premiumCalc ? (deficitPremium >= 0 ? '#28a745' : '#dc3545') : '#dc3545'
                    }}>
                      {premiumCalc ? deficitPremium.toFixed(5) : 'No Data'}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      textAlign: 'right',
                      color: profitData ? (totalSwap >= 0 ? '#28a745' : '#dc3545') : '#dc3545'
                    }}>
                      {profitData ? `$${totalSwap.toFixed(2)}` : 'No Data'}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      textAlign: 'right',
                      fontWeight: '700',
                      color: profitData ? (totalProfit >= 0 ? '#28a745' : '#dc3545') : '#dc3545',
                      fontSize: '14px'
                    }}>
                      {profitData ? `$${totalProfit.toFixed(2)}` : 'No Data'}
                    </td>
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input 
                          type="number" 
                          style={{
                            width: '60px',
                            padding: '4px',
                            border: '1px solid #ddd',
                            borderRadius: '3px',
                            fontSize: '11px'
                          }}
                          placeholder={trade.takeProfit || "TP"} 
                        />
                        <button style={{
                          padding: '4px 8px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}>💾</button>
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <button 
                        style={{
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                        onClick={() => handleCloseTrade(trade.tradeId)}
                        onMouseEnter={e => e.target.style.backgroundColor = '#c82333'}
                        onMouseLeave={e => e.target.style.backgroundColor = '#dc3545'}
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

        </div>
        
        <div style={{ 
          background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)', 
          color: 'white', 
          padding: '15px 20px', 
          borderRadius: '0 0 10px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong style={{ fontSize: '18px' }}>
              Total P&L: $
              {activeTrades
                .filter(trade => trade.accountSetId === selectedSetId && (trade.status === 'Active' || trade.status === 'Partial'))
                .reduce((total, trade) => {
                  const mt5Ticket = trade.broker1?.terminal === 'MT5' ? 
                    trade.broker1Ticket : trade.broker2Ticket;
                  const mt4Ticket = trade.broker1?.terminal === 'MT4' ? 
                    trade.broker1Ticket : trade.broker2Ticket;

                  const profitData = mt4mt5Service.calculateTradeProfit(selectedSetId, mt5Ticket, mt4Ticket);
                  return total + (profitData?.totalProfit || 0);
                }, 0).toFixed(2)}
            </strong>
          </div>
          <div style={{ display: 'flex', gap: '15px', fontSize: '14px', opacity: 0.9 }}>
            <div>
              Active: {activeTrades.filter(trade => trade.accountSetId === selectedSetId && trade.status === 'Active').length}
            </div>
            <div>
              Partial: {activeTrades.filter(trade => trade.accountSetId === selectedSetId && trade.status === 'Partial').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}