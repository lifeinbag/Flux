// src/components/NavBar.jsx

import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import API from '../services/api';
import './NavBar.css';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState('');

  useEffect(() => {
    // Public paths don't need a role
    const PUBLIC = ['/login', '/signup', '/forgot-password', '/reset-password'];
    if (PUBLIC.includes(location.pathname)) {
      setRole('');
      return;
    }

    // If there's no token, we're not logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setRole('');
      return;
    }

    // Otherwise fetch the user's role
    API.get('/users/me')
      .then(res => setRole(res.data.role))
      .catch(() => setRole(''));
  }, [location]);

  const onLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Hide back button on dashboard page
  const showBackButton = location.pathname !== '/dashboard';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        {showBackButton && (
          <button className="btn back" onClick={() => navigate(-1)}>
            ← Back
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        <ul>
          <li>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/active-trades"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Active Trades
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/closed-trades"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Closed Trades
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/pending-orders"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Pending Orders
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/trade-execution"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Trade Execution
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/network"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              My Network
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/link-account"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Link Account
            </NavLink>
          </li>
          {role === 'admin' && (
            <li>
              <NavLink
                to="/admin"
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                Admin
              </NavLink>
            </li>
          )}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button className="btn logout" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}