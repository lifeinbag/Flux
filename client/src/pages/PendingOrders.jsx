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
      <div className="trades-container">
        <table className="active-trades-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Direction</th>
              <th>Volume</th>
              <th>Future Symbol</th>
              <th>Spot Symbol</th>
              <th>Target Premium</th>
              <th>Take Profit</th>
              <th>Stop Loss</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {ordersLoading ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>
                  Loading pending orders...
                </td>
              </tr>
            ) : pendingOrders.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>
                  No pending orders found
                </td>
              </tr>
            ) : (
              pendingOrders.map((order) => (
                <tr key={order.orderId}>
                  <td>{order.orderId ? order.orderId.slice(-8) : 'N/A'}</td>
                  <td>
                    <span style={{ 
                      color: order.direction === 'Buy' ? 'green' : 'red',
                      fontWeight: 'bold'
                    }}>
                      {order.direction}
                    </span>
                  </td>
                  <td>{order.volume}</td>
                  <td>{order.broker1Symbol}</td>
                  <td>{order.broker2Symbol}</td>
                  <td>{parseFloat(order.targetPremium).toFixed(2)}</td>
                  <td>{order.takeProfit ? parseFloat(order.takeProfit).toFixed(2) : '-'}</td>
                  <td>{order.stopLoss ? parseFloat(order.stopLoss).toFixed(2) : '-'}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: order.status === 'Pending' ? '#ffd700' : '#ddd',
                      color: order.status === 'Pending' ? '#000' : '#666',
                      fontSize: '12px'
                    }}>
                      {order.status}
                    </span>
                  </td>
                  <td>{new Date(order.createdAt).toLocaleString()}</td>
                  <td>
                    <button 
                      className="close-btn"
                      onClick={() => handleCancelOrder(order.orderId)}
                      style={{ backgroundColor: '#dc3545' }}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="table-footer">
          <div className="grand-total">
            <strong>Total Pending Orders: {pendingOrders.length}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}