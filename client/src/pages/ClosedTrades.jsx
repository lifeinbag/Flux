import React, { useState, useEffect } from 'react';
import API from '../services/api';

export default function ClosedTrades() {
  const [accountSets, setAccountSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [closedTrades, setClosedTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalProfit, setTotalProfit] = useState(0);
  const [averageProfit, setAverageProfit] = useState(0);

  useEffect(() => {
    loadAccountSets();
  }, []);

  useEffect(() => {
    if (selectedSetId) {
      loadClosedTrades();
    }
  }, [selectedSetId]);

  const loadAccountSets = async () => {
    try {
      const res = await API.get('/account-sets');
      const accountSetsData = res.data.data || res.data;
      if (Array.isArray(accountSetsData)) {
        setAccountSets(accountSetsData);
        if (accountSetsData.length > 0) {
          setSelectedSetId(accountSetsData[0]._id || accountSetsData[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load account sets:', err);
    }
  };

  const loadClosedTrades = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/trading/closed-trades?accountSetId=${selectedSetId}&limit=100`);
      if (res.data.success) {
        setClosedTrades(res.data.trades);
        
        const total = res.data.trades.reduce((sum, trade) => {
          return sum + (parseFloat(trade.totalProfit) || 0);
        }, 0);
        setTotalProfit(total);
        setAverageProfit(res.data.trades.length > 0 ? total / res.data.trades.length : 0);
      }
    } catch (err) {
      console.error('Failed to load closed trades:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const calculateTradeDuration = (openTime, closeTime) => {
    if (!openTime || !closeTime) return 'N/A';
    const start = new Date(openTime);
    const end = new Date(closeTime);
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHours}h ${diffMinutes}m`;
  };

  const selectedAccountSet = accountSets.find(s => (s._id || s.id) === selectedSetId);

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
          Closed Trades
        </h1>
        <p style={{ 
          color: '#b0bec5', 
          marginBottom: '2rem',
          fontSize: '1.1rem'
        }}>
          View your closed trading positions and their performance
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
                Broker 1: {selectedAccountSet.brokers[0]?.terminal} ({selectedAccountSet.brokers[0]?.accountNumber}-{selectedAccountSet.brokers[0]?.brokerName}) • 
                Broker 2: {selectedAccountSet.brokers[1]?.terminal} ({selectedAccountSet.brokers[1]?.accountNumber}-{selectedAccountSet.brokers[1]?.brokerName})
              </span>
            </div>
          )}
        </div>

        {/* Closed Trades History */}
        <div style={{
          background: 'linear-gradient(135deg, #7b1fa2, #ab47bc)',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '1rem'
        }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>
            Closed Trades History
          </h2>
          <p style={{ margin: 0, fontSize: '1rem' }}>
            Total: {closedTrades.length} trades
          </p>
        </div>

        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px'
          }}>
            <div style={{ marginBottom: '1rem' }}>⟳ Loading closed trades...</div>
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
                fontSize: '0.85rem'
              }}>
                <thead style={{
                  background: 'rgba(0,0,0,0.4)',
                  color: 'white'
                }}>
                  <tr>
                    <th style={tableHeaderStyle}>Broker1 (MT5)</th>
                    <th style={tableHeaderStyle}>Broker2 (MT4)</th>
                    <th style={tableHeaderStyle}>Direction</th>
                    <th style={tableHeaderStyle}>Lot Size</th>
                    <th style={tableHeaderStyle}>Broker1 Profit</th>
                    <th style={tableHeaderStyle}>Broker2 Profit</th>
                    <th style={tableHeaderStyle}>Opening Premium</th>
                    <th style={tableHeaderStyle}>Closing Premium</th>
                    <th style={tableHeaderStyle}>Deficit Premium</th>
                    <th style={tableHeaderStyle}>Swap</th>
                    <th style={tableHeaderStyle}>Commission</th>
                    <th style={tableHeaderStyle}>Total Profit</th>
                    <th style={tableHeaderStyle}>Trade Duration</th>
                    <th style={tableHeaderStyle}>Closed At</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((trade, index) => {
                    const profit = parseFloat(trade.totalProfit) || 0;
                    const profitColor = profit >= 0 ? '#43a047' : '#f44336';
                    
                    return (
                      <tr key={trade.tradeId} style={{
                        background: index % 2 === 0 ? 'white' : '#f8f9fa',
                        color: '#333'
                      }}>
                        <td style={tableCellStyle}>{trade.broker1Ticket || 'N/A'}</td>
                        <td style={tableCellStyle}>{trade.broker2Ticket || 'N/A'}</td>
                        <td style={tableCellStyle}>
                          <span style={{
                            background: trade.broker1Direction === 'Buy' ? '#ffcdd2' : '#c8e6c9',
                            color: trade.broker1Direction === 'Buy' ? '#c62828' : '#2e7d32',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                          }}>
                            {trade.broker1Direction === 'Buy' ? 'Buy/Sell' : 'Sell/Buy'}
                          </span>
                        </td>
                        <td style={tableCellStyle}>{trade.broker1Volume || 'N/A'}</td>
                        <td style={{...tableCellStyle, color: profitColor, fontWeight: 'bold'}}>
                          ${(parseFloat(trade.broker1Profit) || 0).toFixed(2)}
                        </td>
                        <td style={{...tableCellStyle, color: profitColor, fontWeight: 'bold'}}>
                          ${(parseFloat(trade.broker2Profit) || 0).toFixed(2)}
                        </td>
                        <td style={tableCellStyle}>{(parseFloat(trade.executionPremium) || 0).toFixed(2)}</td>
                        <td style={tableCellStyle}>{(parseFloat(trade.closePremium) || 0).toFixed(2)}</td>
                        <td style={{...tableCellStyle, color: '#f44336'}}>
                          {((parseFloat(trade.executionPremium) || 0) - (parseFloat(trade.closePremium) || 0)).toFixed(2)}
                        </td>
                        <td style={tableCellStyle}>${(parseFloat(trade.totalSwap) || 0).toFixed(2)}</td>
                        <td style={tableCellStyle}>${(parseFloat(trade.totalCommission) || 0).toFixed(2)}</td>
                        <td style={{...tableCellStyle, color: profitColor, fontWeight: 'bold', fontSize: '1rem'}}>
                          ${profit.toFixed(2)}
                        </td>
                        <td style={tableCellStyle}>
                          {calculateTradeDuration(trade.broker1OpenTime, trade.broker1CloseTime)}
                        </td>
                        <td style={tableCellStyle}>
                          {formatDate(trade.broker1CloseTime).split(' ')[0]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {closedTrades.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: '#666'
                }}>
                  No closed trades found
                </div>
              )}
            </div>

            {/* Total Profit */}
            <div style={{
              background: 'linear-gradient(135deg, #43a047, #66bb6a)',
              padding: '1rem 2rem',
              borderRadius: '0 0 12px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '1.2rem',
              fontWeight: 'bold'
            }}>
              <span>Total Profit: ${totalProfit.toFixed(2)}</span>
              <span>Average: ${averageProfit.toFixed(2)} per trade</span>
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
  fontSize: '0.8rem',
  borderBottom: '2px solid rgba(255,255,255,0.3)',
  color: 'white'
};

const tableCellStyle = {
  padding: '8px',
  borderBottom: '1px solid #e0e0e0',
  fontSize: '0.85rem'
};