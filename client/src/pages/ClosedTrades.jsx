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
      <div className="trades-container">
        <table className="active-trades-table">
          <thead>
            <tr>
              <th>MT5 Ticket</th>
              <th>MT4 Ticket</th>
              <th>Lot Size</th>
              <th>MT5 Profit</th>
              <th>MT4 Profit</th>
              <th>Opening Premium</th>
              <th>Closing Premium</th>
              <th>Total Profit</th>
              <th>Duration (min)</th>
              <th>Close Reason</th>
              <th>Closed At</th>
            </tr>
          </thead>
          <tbody>
            {tradesLoading ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>
                  Loading closed trades...
                </td>
              </tr>
            ) : closedTrades.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>
                  No closed trades found
                </td>
              </tr>
            ) : (
              closedTrades.map((trade) => {
                // Determine which broker is MT5 and which is MT4
                const mt5Data = trade.broker1?.terminal === 'MT5' ? 
                  { ticket: trade.broker1Ticket, profit: trade.broker1Profit || 0 } : 
                  { ticket: trade.broker2Ticket, profit: trade.broker2Profit || 0 };
                
                const mt4Data = trade.broker1?.terminal === 'MT4' ? 
                  { ticket: trade.broker1Ticket, profit: trade.broker1Profit || 0 } : 
                  { ticket: trade.broker2Ticket, profit: trade.broker2Profit || 0 };

                return (
                  <tr key={trade.tradeId}>
                    <td>{mt5Data.ticket}</td>
                    <td>{mt4Data.ticket}</td>
                    <td>{trade.broker1Volume}</td>
                    <td style={{ color: mt5Data.profit >= 0 ? 'green' : 'red' }}>
                      ${parseFloat(mt5Data.profit).toFixed(2)}
                    </td>
                    <td style={{ color: mt4Data.profit >= 0 ? 'green' : 'red' }}>
                      ${parseFloat(mt4Data.profit).toFixed(2)}
                    </td>
                    <td>{parseFloat(trade.executionPremium).toFixed(2)}</td>
                    <td>{parseFloat(trade.closePremium || 0).toFixed(2)}</td>
                    <td style={{ color: trade.totalProfit >= 0 ? 'green' : 'red' }}>
                      <strong>${parseFloat(trade.totalProfit || 0).toFixed(2)}</strong>
                    </td>
                    <td>{trade.tradeDurationMinutes || 0}</td>
                    <td>{trade.closeReason || 'Manual'}</td>
                    <td>{new Date(trade.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="table-footer">
          <div className="grand-total">
            <strong>
              Total Profit: $
              {closedTrades.reduce((sum, trade) => sum + parseFloat(trade.totalProfit || 0), 0).toFixed(2)}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}