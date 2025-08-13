// src/App.js

import React, { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import API from './services/api';

import NavBar from './components/NavBar';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Network from './pages/Network';
import Admin from './pages/Admin';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LinkAccount from './pages/LinkAccount';
import TradeExecution from './components/TradeExecution';
import ActiveTrades from './pages/ActiveTrades';
import ClosedTrades from './pages/ClosedTrades';
import PendingOrders from './pages/PendingOrders';

function TradeExecutionWrapper() {
  const [accountSets, setAccountSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [loading, setLoading] = useState(true);

  // Load all account sets and select the first one
  useEffect(() => {
    console.log('TradeExecutionWrapper: Loading account sets');
    API.get('/account-sets')
      .then(res => {
        console.log('TradeExecutionWrapper: Account sets loaded:', res.data);
        
        // FIXED: Handle the new response format from PostgreSQL backend
        const accountSetsData = res.data.data || res.data;
        if (Array.isArray(accountSetsData)) {
          setAccountSets(accountSetsData);
          if (accountSetsData.length > 0) {
            setSelectedSetId(accountSetsData[0]._id || accountSetsData[0].id);
          }
        } else {
          console.error('TradeExecutionWrapper: Account sets data is not an array:', accountSetsData);
          setAccountSets([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('TradeExecutionWrapper: Failed to load account-sets:', err);
        setAccountSets([]);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading Trade Execution…</p>;

  // Get the selected account set
  const selectedAccountSet = accountSets.find(s => s._id === selectedSetId);

  if (!selectedAccountSet && accountSets.length > 0) {
    return <p>Please select an account set</p>;
  }

  return (
    <div>
      {/* Account Set Selector */}
      {accountSets.length > 0 && (
        <div style={{ 
          padding: '1rem', 
          background: '#f5f5f5', 
          marginBottom: '1rem', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong>Account Set:</strong>
            <select
              value={selectedSetId}
              onChange={e => setSelectedSetId(e.target.value)}
              style={{ 
                padding: '8px 12px', 
                borderRadius: '4px', 
                border: '1px solid #ccc',
                minWidth: '200px'
              }}
            >
              {accountSets.map(set => (
                <option key={set._id} value={set._id}>
                  {set.name}
                </option>
              ))}
            </select>
          </label>
          {selectedAccountSet && (
            <div style={{ marginTop: '8px', fontSize: '0.9em', color: '#666' }}>
              <span>
                Broker 1: {selectedAccountSet.brokers[0]?.terminal} ({selectedAccountSet.brokers[0]?.server}) • 
                Broker 2: {selectedAccountSet.brokers[1]?.terminal} ({selectedAccountSet.brokers[1]?.server})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Trade Execution Component - Pass the selected account set */}
      <TradeExecution accountSet={selectedAccountSet} />
    </div>
  );
}

function PrivateRoute({ children }) {
  return localStorage.getItem('token')
    ? children
    : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const [allowed, setAllowed] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    API.get('/users/me')
      .then(res => {
        if (res.data.role === 'admin') setAllowed(true);
        else nav('/dashboard');
      })
      .catch(() => nav('/login'));
  }, [nav]);

  if (allowed === null) return <p>Loading…</p>;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const hideNav = publicPaths.includes(location.pathname);

  return (
    <>
      {!hideNav && <NavBar />}

      <div style={{ padding: '1rem', maxWidth: 1200, margin: hideNav ? '0 auto' : '0 auto 0 200px' }}>
        <Routes>
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/active-trades" element={<PrivateRoute><ActiveTrades /></PrivateRoute>} />
          <Route path="/closed-trades" element={<PrivateRoute><ClosedTrades /></PrivateRoute>} />
          <Route path="/pending-orders" element={<PrivateRoute><PendingOrders /></PrivateRoute>} />
          <Route path="/trade-execution" element={<PrivateRoute><TradeExecutionWrapper /></PrivateRoute>} />
          <Route path="/network" element={<PrivateRoute><Network /></PrivateRoute>} />
          <Route path="/link-account" element={<PrivateRoute><LinkAccount /></PrivateRoute>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}