// src/pages/PendingOrders.jsx

import React, { useState, useEffect } from 'react';
import API from '../services/api';
import './ActiveTrades.css'; // Reuse the same CSS

export default function PendingOrders() {
  const [accountSets, setAccountSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Fetch pending orders for selected account set
  const fetchPendingOrders = async (accountSetId) => {
    if (!accountSetId) return;
    
    setOrdersLoading(true);
    try {
      const params = accountSetId ? { accountSetId } : {};
      const res = await API.get('/trading/pending-orders', { params });
      const orders = res.data.orders || [];
      setPendingOrders(orders);
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      setPendingOrders([]);
    }
    setOrdersLoading(false);
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
            fetchPendingOrders(firstSetId);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setAccountSets([]);
        setLoading(false);
      });
  }, []);

  // Fetch pending orders when account set changes
  useEffect(() => {
    if (selectedSetId) {
      fetchPendingOrders(selectedSetId);
    }
  }, [selectedSetId]);

  // Handle cancel order
  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this pending order?')) return;
    
    try {
      await API.post('/trading/cancel-pending', { orderId });
      // Refresh orders after canceling
      fetchPendingOrders(selectedSetId);
      alert('Pending order cancelled successfully');
    } catch (error) {
      console.error('Error canceling order:', error);
      alert('Failed to cancel order: ' + (error.response?.data?.message || error.message));
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="active-trades-page">
      <div className="page-header">
        <h1>Pending Orders</h1>
        <p>Monitor your pending orders waiting for target premium</p>
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

      {/* Pending Orders Table */}
      <div className="trades-container" style={{ marginTop: '20px' }}>
        <div className="table-header" style={{ 
          background: 'linear-gradient(135deg, #fd7e14 0%, #e83e8c 100%)', 
          color: 'white', 
          padding: '15px 20px', 
          borderRadius: '10px 10px 0 0',
          marginBottom: '0'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Pending Orders Queue</h3>
          <span style={{ fontSize: '14px', opacity: 0.9 }}>Total: {pendingOrders.length} orders</span>
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
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Order ID</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Direction</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Volume</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Future Symbol</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Spot Symbol</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Target Premium</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Take Profit</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Stop Loss</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Status</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057', borderRight: '1px solid #dee2e6' }}>Created At</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {ordersLoading ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <div style={{ width: '20px', height: '20px', border: '3px solid #f3f3f3', borderTop: '3px solid #fd7e14', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    Loading pending orders...
                  </div>
                </td>
              </tr>
            ) : pendingOrders.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                  <div style={{ fontSize: '16px' }}>⏳ No pending orders found</div>
                  <div style={{ fontSize: '12px', marginTop: '5px' }}>Pending orders waiting for target premium will appear here</div>
                </td>
              </tr>
            ) : (
              pendingOrders.map((order, index) => (
                <tr key={order.orderId} style={{ 
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                  borderBottom: '1px solid #dee2e6',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.target.parentElement.style.backgroundColor = '#e3f2fd'}
                onMouseLeave={e => e.target.parentElement.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa'}
                >
                  <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', fontFamily: 'monospace' }}>
                    {order.orderId ? order.orderId.slice(-8) : 'N/A'}
                  </td>
                  <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6' }}>
                    <span style={{ 
                      color: order.direction === 'Buy' ? '#28a745' : '#dc3545',
                      fontWeight: '600',
                      fontSize: '12px',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      backgroundColor: order.direction === 'Buy' ? '#d4edda' : '#f8d7da'
                    }}>
                      {order.direction}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', textAlign: 'center' }}>
                    {order.volume}
                  </td>
                  <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', fontFamily: 'monospace', fontSize: '12px' }}>
                    {order.broker1Symbol}
                  </td>
                  <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', fontFamily: 'monospace', fontSize: '12px' }}>
                    {order.broker2Symbol}
                  </td>
                  <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', textAlign: 'right', fontWeight: '600' }}>
                    {parseFloat(order.targetPremium).toFixed(5)}
                  </td>
                  <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', textAlign: 'right' }}>
                    {order.takeProfit ? parseFloat(order.takeProfit).toFixed(2) : <em style={{color: '#999'}}>None</em>}
                  </td>
                  <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', textAlign: 'right' }}>
                    {order.stopLoss ? parseFloat(order.stopLoss).toFixed(2) : <em style={{color: '#999'}}>None</em>}
                  </td>
                  <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      backgroundColor: order.status === 'Pending' ? '#fff3cd' : '#e9ecef',
                      color: order.status === 'Pending' ? '#856404' : '#6c757d',
                      fontSize: '11px',
                      fontWeight: '600',
                      border: `1px solid ${order.status === 'Pending' ? '#ffeeba' : '#dee2e6'}`
                    }}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', borderRight: '1px solid #dee2e6', fontSize: '11px', color: '#6c757d' }}>
                    <div>{new Date(order.createdAt).toLocaleDateString()}</div>
                    <div>{new Date(order.createdAt).toLocaleTimeString()}</div>
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
                      onClick={() => handleCancelOrder(order.orderId)}
                      onMouseEnter={e => e.target.style.backgroundColor = '#c82333'}
                      onMouseLeave={e => e.target.style.backgroundColor = '#dc3545'}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        </div>
        
        <div style={{ 
          background: 'linear-gradient(135deg, #6f42c1 0%, #6610f2 100%)', 
          color: 'white', 
          padding: '15px 20px', 
          borderRadius: '0 0 10px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong style={{ fontSize: '18px' }}>Total Pending Orders: {pendingOrders.length}</strong>
          </div>
          <div style={{ display: 'flex', gap: '15px', fontSize: '14px', opacity: 0.9 }}>
            <div>
              Pending: {pendingOrders.filter(order => order.status === 'Pending').length}
            </div>
            {pendingOrders.some(order => order.status !== 'Pending') && (
              <div>
                Other: {pendingOrders.filter(order => order.status !== 'Pending').length}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}