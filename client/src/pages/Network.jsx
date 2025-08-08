// client/src/pages/Network.jsx

import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  Share2,
  Copy,
  CheckCircle,
  ArrowLeft
} from 'lucide-react';
import API from '../services/api';
import './Dashboard.css';

export default function Network() {
  // share percentages
  const [level1Share, setLevel1Share] = useState(0);
  const [level2Share, setLevel2Share] = useState(0);

  // referral lists
  const [level1, setLevel1] = useState([]);
  const [level2, setLevel2] = useState([]);

  // save/copy status
  const [saveStatus, setSaveStatus] = useState('');

  // user data (for referral link)
  const [user, setUser] = useState(null);

  // --- fetch network & parse shares as numbers ---
  const fetchNetworkData = async () => {
    try {
      const res = await API.get('/users/network');
      console.log('Network data received:', res.data);
      const {
        level1Share: l1,
        level2Share: l2,
        level1: lvl1List,
        level2: lvl2List
      } = res.data;

      const parsedL1 = parseFloat(l1) || 0;
      const parsedL2 = parseFloat(l2) || 0;

      setLevel1Share(parsedL1);
      setLevel2Share(parsedL2);
      setLevel1(Array.isArray(lvl1List) ? lvl1List : []);
      setLevel2(Array.isArray(lvl2List) ? lvl2List : []);
    } catch (err) {
      console.error('Failed to load network data', err);
      setLevel1([]);
      setLevel2([]);
    }
  };

  useEffect(() => {
    // load current user
    const fetchUser = async () => {
      try {
        const res = await API.get('/users/me');
        setUser(res.data);
      } catch (err) {
        console.error('Failed to load user data', err);
      }
    };

    fetchUser();
    fetchNetworkData();
  }, []);

  // --- save shares & re-fetch ---
  const saveShares = async () => {
    setSaveStatus('saving');
    try {
      await API.post('/users/network/shares', {
        level1: level1Share,
        level2: level2Share
      });
      setSaveStatus('success');
      // refresh network so cards update immediately
      await fetchNetworkData();
    } catch (err) {
      console.error('Save failed', err);
      setSaveStatus('error');
    } finally {
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  // copy referral link
  const copyReferralLink = () => {
    const link = `${window.location.origin}/signup?ref=${user?.referralCode || ''}`;
    navigator.clipboard.writeText(link);
    setSaveStatus('copied');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  const referralLink = user
    ? `${window.location.origin}/signup?ref=${user.referralCode}`
    : '';

  return (
    <div className="modern-dashboard">
      <div className="dashboard-content">

        {/* Header */}
        <div className="dashboard-header">
          <button
            onClick={() => window.history.back()}
            className="back-button"
            style={{
              background: 'transparent',
              color: '#cbd5e1',
              border: 'none',
              marginBottom: '1rem',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            Back
          </button>
          <h1>Your Network</h1>
          <p>Manage your referral network and commission settings</p>
        </div>

        {/* Stats Overview */}
        <div className="performance-grid">
          {/* Total Referrals */}
          <div className="performance-card">
            <div className="card-header">
              <div className="card-icon">
                <Users style={{ width: '24px', height: '24px', color: '#4a90e2' }} />
              </div>
              <div className="card-info">
                <h3>Total Referrals</h3>
                <p>Network Size</p>
              </div>
            </div>
            <div className="card-value">{level1.length + level2.length}</div>
            <div className="card-change positive">Active Network</div>
          </div>

          {/* Level 1 */}
          <div className="performance-card">
            <div className="card-header">
              <div className="card-icon">
                <TrendingUp style={{ width: '24px', height: '24px', color: '#10b981' }} />
              </div>
              <div className="card-info">
                <h3>Level 1</h3>
                <p>Direct Referrals</p>
              </div>
            </div>
            <div className="card-value">{level1.length}</div>
            <div className="card-change positive">
              {level1Share.toFixed(2)}% Commission
            </div>
          </div>

          {/* Level 2 */}
          <div className="performance-card">
            <div className="card-header">
              <div className="card-icon">
                <Share2 style={{ width: '24px', height: '24px', color: '#a78bfa' }} />
              </div>
              <div className="card-info">
                <h3>Level 2</h3>
                <p>Indirect Referrals</p>
              </div>
            </div>
            <div className="card-value">{level2.length}</div>
            <div className="card-change positive">
              {level2Share.toFixed(2)}% Commission
            </div>
          </div>

          {/* Total Commission */}
          <div className="performance-card">
            <div className="card-header">
              <div className="card-icon">
                <DollarSign style={{ width: '24px', height: '24px', color: '#fbbf24' }} />
              </div>
              <div className="card-info">
                <h3>Total Commission</h3>
                <p>Combined Rate</p>
              </div>
            </div>
            <div className="card-value">
              {(level1Share + level2Share).toFixed(2)}%
            </div>
            <div className="card-change positive">Revenue Share</div>
          </div>
        </div>

        {/* Commission Settings */}
        <div className="modern-selector-section">
          <div className="section-header">
            <h2>Commission Settings</h2>
            <p>Set your referral commission percentages</p>
          </div>
          <div className="symbol-selectors">
            <div className="symbol-group">
              <label>
                <strong>Level-1 Share (%):</strong>
                <input
                  type="number"
                  value={level1Share}
                  onChange={e => setLevel1Share(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  step="0.1"
                  className="modern-input"
                />
              </label>
            </div>
            <div className="symbol-group">
              <label>
                <strong>Level-2 Share (%):</strong>
                <input
                  type="number"
                  value={level2Share}
                  onChange={e => setLevel2Share(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  step="0.1"
                  className="modern-input"
                />
              </label>
            </div>
            <div className="symbol-stats">
              <button
                onClick={saveShares}
                className="copy-btn"
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? (
                  <>
                    <div className="loading-spinner" />
                    Saving...
                  </>
                ) : saveStatus === 'success' ? (
                  <>
                    <CheckCircle style={{ width: '16px', height: '16px' }} />
                    Saved!
                  </>
                ) : (
                  'Save Shares'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Referral Link */}
        <div className="info-card">
          <div className="card-header">
            <h3>Your Referral Link</h3>
          </div>
          <div className="referral-input-group">
            <input
              type="text"
              value={referralLink}
              readOnly
              onFocus={e => e.target.select()}
              className="referral-input"
            />
            <button onClick={copyReferralLink} className="copy-btn">
              {saveStatus === 'copied' ? (
                <>
                  <CheckCircle style={{ width: '16px', height: '16px' }} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy style={{ width: '16px', height: '16px' }} />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Referrals Section */}
        <div className="info-grid">
          {/* Level-1 Referrals */}
          <div className="info-card">
            <div className="card-header">
              <h3>Level-1 Referrals</h3>
              <div className="status-indicator online">
                <div className="status-dot" />
                {level1.length} Direct
              </div>
            </div>
            {level1.length > 0 ? (
              <div className="account-list">
                {level1.map((ref, idx) => (
                  <div key={idx} className="account-item">
                    <div>
                      <strong>{ref.email}</strong>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: '#94a3b8',
                          marginTop: '0.25rem'
                        }}
                      >
                        MT4: {ref.mt4Account || 'Not linked'} | MT5:{' '}
                        {ref.mt5Account || 'Not linked'}
                      </div>
                    </div>
                    <span
                      style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}
                    >
                      Direct
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: '#94a3b8'
                }}
              >
                <Users
                  style={{
                    width: '48px',
                    height: '48px',
                    margin: '0 auto 1rem',
                    opacity: 0.5
                  }}
                />
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>
                  No level-1 referrals yet
                </p>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  Share your referral link to get started
                </p>
              </div>
            )}
          </div>

          {/* Level-2 Referrals */}
          <div className="info-card">
            <div className="card-header">
              <h3>Level-2 Referrals</h3>
              <div className="status-indicator online">
                <div className="status-dot" />
                {level2.length} Indirect
              </div>
            </div>
            {level2.length > 0 ? (
              <div className="account-list">
                {level2.map((ref, idx) => (
                  <div key={idx} className="account-item">
                    <div>
                      <strong>{ref.email}</strong>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: '#94a3b8',
                          marginTop: '0.25rem'
                        }}
                      >
                        MT4: {ref.mt4Account || 'Not linked'} | MT5:{' '}
                        {ref.mt5Account || 'Not linked'}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: '#a78bfa',
                          marginTop: '0.25rem'
                        }}
                      >
                        Sponsored by:{' '}
                        {ref.sponsorEmail ||
                          ref.sponsor?.email ||
                          (ref.sponsor
                            ? `User ${ref.sponsor.slice(-6)}`
                            : 'Unknown')}
                      </div>
                    </div>
                    <span
                      style={{
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        color: '#a78bfa',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}
                    >
                      Indirect
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: '#94a3b8'
                }}
              >
                <Share2
                  style={{
                    width: '48px',
                    height: '48px',
                    margin: '0 auto 1rem',
                    opacity: 0.5
                  }}
                />
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>
                  No level-2 referrals yet
                </p>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  These come from your referrals' referrals
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="info-card">
          <div className="card-header">
            <h3>How it works</h3>
          </div>
          <div style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
            <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Level-1:</strong> Direct referrals earn you the Level-1
                share percentage
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Level-2:</strong> Your referrals' referrals earn you
                the Level-2 share percentage
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Commission:</strong> Calculated based on their trading
                volume
              </li>
              <li>
                <strong>Growth:</strong> Share your referral link to grow your
                network
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
