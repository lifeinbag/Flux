// src/pages/ClosedTrades.jsx

import React, { useState, useEffect } from 'react';
import API from '../services/api';
import './ActiveTrades.css'; // Reuse the same CSS

export default function ClosedTrades() {
  const [accountSets, setAccountSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [closedTrades, setClosedTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tradesLoading, setTradesLoading] = useState(false);

  // Fetch closed trades for selected account set
  const fetchClosedTrades = async (accountSetId) => {
    if (!accountSetId) return;
    
    setTradesLoading(true);
    try {
      const params = accountSetId ? { accountSetId } : {};
      const res = await API.get('/trading/closed-trades', { params });
      const trades = res.data.trades || [];
      setClosedTrades(trades);
    } catch (error) {
      console.error('Error fetching closed trades:', error);
      setClosedTrades([]);
    }
    setTradesLoading(false);
  };

  useEffect(() => {
    API.get('/account-sets')
      .then(res => {
        const accountSetsData = res.data.data || res.data;
        if (Array.isArray(accountSetsData)) {
          setAccountSets(accountSetsData);
          if (accountSetsData.length > 0) {
            const firstSetId = accountSetsData[0]._id || accountSetsData[0].id;
            setSelectedSetId(firstSetId);
            fetchClosedTrades(firstSetId);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setAccountSets([]);
        setLoading(false);
      });
  }, []);

  // Fetch closed trades when account set changes
  useEffect(() => {
    if (selectedSetId) {
      fetchClosedTrades(selectedSetId);
    }
  }, [selectedSetId]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="active-trades-page">
      <div className="page-header">
        <h1>Closed Trades</h1>
        <p>View your closed trading positions and their performance</p>
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

      {/* Closed Trades Table */}
      <div className="trades-container" style={{ marginTop: '20px' }}>
        <div className="table-header" style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          color: 'white', 
          padding: '15px 20px', 
          borderRadius: '10px 10px 0 0',
          marginBottom: '0'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Closed Trades History</h3>
          <span style={{ fontSize: '14px', opacity: 0.9 }}>Total: {closedTrades.length} trades</span>
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
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Closing Premium</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Deficit Premium</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Swap</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Commission</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Total Profit</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Trade Duration</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Closed At</th>
              </tr>
            </thead>
          <tbody>
            {tradesLoading ? (
              <tr>
                <td colSpan="14" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <div style={{ width: '20px', height: '20px', border: '3px solid #f3f3f3', borderTop: '3px solid #007bff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    Loading closed trades...
                  </div>
                </td>
              </tr>
            ) : closedTrades.length === 0 ? (
              <tr>
                <td colSpan="14" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                  <div style={{ fontSize: '16px' }}>📊 No closed trades found</div>
                  <div style={{ fontSize: '12px', marginTop: '5px' }}>Closed trades will appear here after you close active positions</div>
                </td>
              </tr>
            ) : (
              closedTrades.map((trade, index) => {
                // Determine which broker is MT5 and which is MT4
                const broker1Data = trade.broker1 || {};
                const broker2Data = trade.broker2 || {};
                
                const mt5Data = broker1Data.terminal === 'MT5' ? 
                  { ticket: trade.broker1Ticket, profit: trade.broker1Profit || 0 } : 
                  broker2Data.terminal === 'MT5' ? 
                  { ticket: trade.broker2Ticket, profit: trade.broker2Profit || 0 } : 
                  { ticket: null, profit: 0 };
                
                const mt4Data = broker1Data.terminal === 'MT4' ? 
                  { ticket: trade.broker1Ticket, profit: trade.broker1Profit || 0 } : 
                  broker2Data.terminal === 'MT4' ? 
                  { ticket: trade.broker2Ticket, profit: trade.broker2Profit || 0 } : 
                  { ticket: null, profit: 0 };

                // Calculate additional fields
                const swap = (trade.broker1Swap || 0) + (trade.broker2Swap || 0);
                const commission = (trade.broker1Commission || 0) + (trade.broker2Commission || 0);
                const deficitPremium = (trade.executionPremium || 0) - (trade.closePremium || 0);
                const totalProfit = mt5Data.profit + mt4Data.profit + swap + commission;
                
                // Format duration
                const duration = trade.tradeDurationMinutes || 0;
                const hours = Math.floor(duration / 60);
                const minutes = duration % 60;
                const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

                return (
                  <tr key={trade.tradeId} style={{ 
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                    borderBottom: '1px solid #dee2e6',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={e => e.target.parentElement.style.backgroundColor = '#e3f2fd'}
                  onMouseLeave={e => e.target.parentElement.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa'}
                  >
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', fontFamily: 'monospace' }}>
                      {mt5Data.ticket || <em style={{color: '#999'}}>No MT5</em>}
                    </td>
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', fontFamily: 'monospace' }}>
                      {mt4Data.ticket || <em style={{color: '#999'}}>No MT4</em>}
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
                        {trade.broker1Direction || trade.broker2Direction || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', textAlign: 'center' }}>
                      {trade.broker1Volume || trade.broker2Volume || 'N/A'}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      color: mt5Data.profit >= 0 ? '#28a745' : '#dc3545',
                      fontWeight: '600',
                      textAlign: 'right'
                    }}>
                      ${mt5Data.profit.toFixed(2)}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      color: mt4Data.profit >= 0 ? '#28a745' : '#dc3545',
                      fontWeight: '600',
                      textAlign: 'right'
                    }}>
                      ${mt4Data.profit.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', textAlign: 'right' }}>
                      {parseFloat(trade.executionPremium || 0).toFixed(5)}
                    </td>
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', textAlign: 'right' }}>
                      {parseFloat(trade.closePremium || 0).toFixed(5)}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      textAlign: 'right',
                      color: deficitPremium >= 0 ? '#28a745' : '#dc3545'
                    }}>
                      {deficitPremium.toFixed(5)}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      textAlign: 'right',
                      color: swap >= 0 ? '#28a745' : '#dc3545'
                    }}>
                      ${swap.toFixed(2)}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      textAlign: 'right',
                      color: commission >= 0 ? '#28a745' : '#dc3545'
                    }}>
                      ${commission.toFixed(2)}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      borderRight: '1px solid #dee2e6', 
                      textAlign: 'right',
                      fontWeight: '700',
                      color: totalProfit >= 0 ? '#28a745' : '#dc3545',
                      fontSize: '14px'
                    }}>
                      ${totalProfit.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', textAlign: 'center' }}>
                      <span style={{ 
                        backgroundColor: '#e9ecef',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        color: '#495057'
                      }}>
                        {durationStr}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: '11px', color: '#6c757d' }}>
                      <div>{new Date(trade.broker1CloseTime || trade.broker2CloseTime || trade.createdAt).toLocaleDateString()}</div>
                      <div>{new Date(trade.broker1CloseTime || trade.broker2CloseTime || trade.createdAt).toLocaleTimeString()}</div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        </div>
        
        <div style={{ 
          background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', 
          color: 'white', 
          padding: '15px 20px', 
          borderRadius: '0 0 10px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong style={{ fontSize: '18px' }}>
              Total Profit: $
              {closedTrades.reduce((sum, trade) => {
                const mt5Profit = (trade.broker1?.terminal === 'MT5' ? trade.broker1Profit : trade.broker2Profit) || 0;
                const mt4Profit = (trade.broker1?.terminal === 'MT4' ? trade.broker1Profit : trade.broker2Profit) || 0;
                const swap = (trade.broker1Swap || 0) + (trade.broker2Swap || 0);
                const commission = (trade.broker1Commission || 0) + (trade.broker2Commission || 0);
                return sum + mt5Profit + mt4Profit + swap + commission;
              }, 0).toFixed(2)}
            </strong>
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            Average: $
            {closedTrades.length > 0 ? 
              (closedTrades.reduce((sum, trade) => {
                const mt5Profit = (trade.broker1?.terminal === 'MT5' ? trade.broker1Profit : trade.broker2Profit) || 0;
                const mt4Profit = (trade.broker1?.terminal === 'MT4' ? trade.broker1Profit : trade.broker2Profit) || 0;
                const swap = (trade.broker1Swap || 0) + (trade.broker2Swap || 0);
                const commission = (trade.broker1Commission || 0) + (trade.broker2Commission || 0);
                return sum + mt5Profit + mt4Profit + swap + commission;
              }, 0) / closedTrades.length).toFixed(2) :
              '0.00'
            } per trade
          </div>
        </div>
      </div>
    </div>
  );
}