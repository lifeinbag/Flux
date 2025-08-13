import React, { useState, useEffect } from 'react';
import API from '../services/api';

export default function PendingOrders() {
  const [accountSets, setAccountSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadAccountSets();
  }, []);

  useEffect(() => {
    if (selectedSetId) {
      loadPendingOrders();
    }
  }, [selectedSetId]);

  // ✅ AUTO-REFRESH: Refresh pending orders every 5 seconds
  useEffect(() => {
    if (!selectedSetId || !autoRefresh) return;

    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing pending orders...');
      loadPendingOrders(false); // Don't show loading spinner for auto-refresh
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [selectedSetId, autoRefresh]);

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

  const loadPendingOrders = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const res = await API.get(`/trading/pending-orders?accountSetId=${selectedSetId}`);
      if (res.data.success) {
        setPendingOrders(res.data.orders);
        console.log(`📋 Loaded ${res.data.orders.length} pending orders`);
      }
    } catch (err) {
      console.error('Failed to load pending orders:', err);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const cancelPendingOrder = async (orderId) => {
    try {
      const res = await API.post('/trading/cancel-pending', { orderId });
      
      if (res.data.success) {
        loadPendingOrders();
        alert('Pending order cancelled successfully');
      }
    } catch (err) {
      console.error('Failed to cancel pending order:', err);
      alert('Failed to cancel pending order: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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
          Pending Orders
        </h1>
        <p style={{ 
          color: '#b0bec5', 
          marginBottom: '2rem',
          fontSize: '1.1rem'
        }}>
          Monitor your pending orders waiting for target premium
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

        {/* Pending Orders Queue */}
        <div style={{
          background: 'linear-gradient(135deg, #ff7043, #ff8a65)',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>
                Pending Orders Queue
              </h2>
              <p style={{ margin: 0, fontSize: '1rem' }}>
                Total: {pendingOrders.length} orders
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'white' }}>
                Auto-refresh:
              </label>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{
                  background: autoRefresh ? '#4CAF50' : '#f44336',
                  color: 'white',
                  border: 'none',
                  padding: '0.3rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {autoRefresh ? '✓ ON' : '✗ OFF'}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px'
          }}>
            <div style={{ marginBottom: '1rem' }}>⟳ Loading pending orders...</div>
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
                  background: 'rgba(0,0,0,0.4)',
                  color: 'white'
                }}>
                  <tr>
                    <th style={tableHeaderStyle}>Order ID</th>
                    <th style={tableHeaderStyle}>Direction</th>
                    <th style={tableHeaderStyle}>Volume</th>
                    <th style={tableHeaderStyle}>Broker1 (MT5)</th>
                    <th style={tableHeaderStyle}>Broker2 (MT4)</th>
                    <th style={tableHeaderStyle}>Target Premium</th>
                    <th style={tableHeaderStyle}>Take Profit</th>
                    <th style={tableHeaderStyle}>Status</th>
                    <th style={tableHeaderStyle}>Created At</th>
                    <th style={tableHeaderStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map((order, index) => (
                    <tr key={order.orderId} style={{
                      background: index % 2 === 0 ? 'white' : '#f8f9fa',
                      color: '#333'
                    }}>
                      <td style={tableCellStyle}>{order.orderId}</td>
                      <td style={tableCellStyle}>
                        <span style={{
                          background: order.direction === 'Buy' ? '#c8e6c9' : '#ffcdd2',
                          color: order.direction === 'Buy' ? '#2e7d32' : '#c62828',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold'
                        }}>
                          {order.direction}
                        </span>
                      </td>
                      <td style={tableCellStyle}>{order.volume}</td>
                      <td style={tableCellStyle}>
                        {order.broker1 ? `${order.broker1.terminal} (${order.broker1.brokerName})` : 'N/A'}
                      </td>
                      <td style={tableCellStyle}>
                        {order.broker2 ? `${order.broker2.terminal} (${order.broker2.brokerName})` : 'N/A'}
                      </td>
                      <td style={{...tableCellStyle, fontWeight: 'bold', color: '#ff7043'}}>
                        {parseFloat(order.targetPremium).toFixed(2)}
                      </td>
                      <td style={tableCellStyle}>
                        {order.takeProfit ? parseFloat(order.takeProfit).toFixed(2) : 'N/A'}
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{
                          background: order.status === 'Pending' ? '#fff3e0' : '#e8f5e8',
                          color: order.status === 'Pending' ? '#f57c00' : '#2e7d32',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold'
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        {formatDate(order.createdAt)}
                      </td>
                      <td style={tableCellStyle}>
                        {order.status === 'Pending' && (
                          <button
                            onClick={() => cancelPendingOrder(order.orderId)}
                            style={{
                              background: '#f44336',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {pendingOrders.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: '#666'
                }}>
                  No pending orders found
                </div>
              )}
            </div>

            {/* Total Pending Orders */}
            <div style={{
              background: 'linear-gradient(135deg, #7b1fa2, #ab47bc)',
              padding: '1rem 2rem',
              borderRadius: '0 0 12px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '1.2rem',
              fontWeight: 'bold'
            }}>
              <span>Total Pending Orders: {pendingOrders.length}</span>
              <span>Pending: {pendingOrders.filter(o => o.status === 'Pending').length}</span>
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