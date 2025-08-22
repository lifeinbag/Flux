// src/pages/LinkAccount.jsx
import React, { useState, useEffect } from 'react';
import API from '../services/api';
import NavBar from '../components/NavBar';
import { ArrowLeft, Link as LinkIcon, Server, User, Lock, CheckCircle, AlertCircle, Trash2, Plus, Building2, AlertTriangle } from 'lucide-react';
import FlowerAnimation from '../components/FlowerAnimation';
import './Dashboard.css';

export default function LinkAccount() {
const emptyBroker = {
  brokerName: '',
  terminal: 'MT4',
  serverNameInput: '',
  accountNumber: '',
  password: '',
  status: '',
  token: null,
  error: null
};

  const [sets, setSets]               = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('new');
  const [name, setName]               = useState('');
  const [brokers, setBrokers]         = useState([ { ...emptyBroker }, { ...emptyBroker } ]);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');

  useEffect(() => {
    fetchSets();
  }, []);

  async function fetchSets() {
    try {
      const res = await API.get('/account-sets');
      const accountSetsData = res.data.data || res.data;
      if (Array.isArray(accountSetsData)) {
        setSets(accountSetsData);
      } else {
        setSets([]);
      }
    } catch (err) {
      setSets([]);
    }
  }

  function handleSetChange(e) {
    const id = e.target.value;
    setSelectedSetId(id);
    setSaveError('');

    if (id === 'new') {
      setBrokers([ { ...emptyBroker }, { ...emptyBroker } ]);
      setName('');
    } else {
      const setObj = sets.find(s => s._id === id);
      setName(setObj.name || '');
  const loaded = setObj.brokers.map(b => ({
  brokerName:      b.brokerName || '',
  terminal:        b.terminal,
  serverNameInput: b.server,
  accountNumber:   b.accountNumber,
  password:        b.password,
  status:          '',
  token:           null,
  error:           null
}));
      while (loaded.length < 2) loaded.push({ ...emptyBroker });
      setBrokers(loaded.slice(0,2));
    }
  }

function handleFieldChange(idx, field, val) {
  const copy = [...brokers];
  
  // Apply validation for brokerName field
  if (field === 'brokerName') {
    // Remove spaces
    val = val.replace(/\s/g, '');
    // Remove numbers
    val = val.replace(/\d/g, '');
    // Capitalize first letter
    if (val.length > 0) {
      val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
    }
  }
  
  copy[idx] = { ...copy[idx], [field]: val, error: null };
  setBrokers(copy);
}
  
  function validateForm() {
  return brokers.every(broker => 
    broker.brokerName.trim() !== '' &&
    broker.terminal !== '' &&
    broker.serverNameInput.trim() !== '' &&
    broker.accountNumber.trim() !== '' &&
    broker.password.trim() !== ''
  );
}

  async function handleLinkAndSave() {
    setSaveError('');
    setSaving(true);

    const updated = await Promise.all(
      brokers.map(async (b, idx) => {
        let slot = { ...b, status: 'pending', error: null, token: null };
        setBrokers(curr => {
          const c = [...curr]; c[idx] = slot; return c;
        });

        try {
          const nameInput = slot.serverNameInput.trim();
          if (!nameInput) throw new Error('Server name is required');

          const resp = await API.post('/trading/connect', {
            terminal:      slot.terminal,
            serverName:    nameInput,
            accountNumber: slot.accountNumber,
            password:      slot.password
          });

          const { success, token, message } = resp.data;

          if (success === true && typeof token === 'string' && !token.startsWith('[error]')) {
            slot = { ...slot, status: 'linked', token };

           //wait API.post('/users/account', {
           // terminal:      slot.terminal,
           // token:         token,
           // serverName:    nameInput,
           // accountNumber: slot.accountNumber
           // });
          } else {
            const errText = message || token || 'Unknown error';
            slot = { ...slot, status: 'error', error: errText };
          }
        } catch (err) {
          slot = {
            ...slot,
            status: 'error',
            error: err.response?.data?.message || err.message || 'Connection failed'
          };
        }

        setBrokers(curr => {
          const c = [...curr]; c[idx] = slot; return c;
        });
        return slot;
      })
    );

    if (updated.some(u => u.status === 'error')) {
      setSaveError('One or more accounts failed to link. Fix errors above and retry.');
      setSaving(false);
      return;
    }

    try {
const payload = {
  name: name.trim(),
  brokers: updated.map(b => ({
    brokerName:    b.brokerName,
    terminal:      b.terminal,
    server:        b.serverNameInput.trim(),
    accountNumber: b.accountNumber,
    password:      b.password
  }))
};

      if (selectedSetId === 'new') {
        await API.post('/account-sets', payload);
      } else {
        await API.patch(`/account-sets/${selectedSetId}`, payload);
      }

      await fetchSets();
      setSelectedSetId('new');
      setName('');
      alert('All accounts linked and set saved!');
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSet() {
    if (!window.confirm('Delete this set?')) return;
    try {
      await API.delete(`/account-sets/${selectedSetId}`);
      await fetchSets();
      setSelectedSetId('new');
      setName('');
    } catch (err) {
      alert('Could not delete set: ' + err.message);
    }
  }

  const getStatusIcon = (status) => {
    switch(status) {
      case 'linked': return <CheckCircle style={{ width: '16px', height: '16px', color: '#10b981' }} />;
      case 'error': return <AlertCircle style={{ width: '16px', height: '16px', color: '#ef4444' }} />;
      case 'pending': return <div className="loading-spinner" style={{ width: '16px', height: '16px' }} />;
      default: return null;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'linked': return '#10b981';
      case 'error': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <>
      <NavBar />
      <FlowerAnimation show={saving} />
      <div className="modern-dashboard">
        <div className="dashboard-content">
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
            <h1>Link Broker Accounts</h1>
            <p>Set up your trading account connections</p>
          </div>

          {saveError && (
            <div className="error-alert">
              <AlertCircle className="error-icon" />
              {saveError}
            </div>
          )}

          <div className="modern-selector-section">
            <div className="section-header">
              <h2>Account Set Configuration</h2>
              <p>Create or select an account set to manage</p>
            </div>
            
            <div className="symbol-selectors">
              <div className="symbol-group">
                <label>
                  <strong>Set Name:</strong>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter a name for this set"
                    className="modern-input"
                  />
                </label>
              </div>

              <div className="symbol-group">
                <label>
                  <strong>Account Set:</strong>
                  <select 
                    value={selectedSetId} 
                    onChange={handleSetChange}
                    className="modern-select"
                  >
                    <option value="new">➕ New Set</option>
                    {sets.map(s => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="symbol-stats">
                {selectedSetId !== 'new' && (
                  <button
                    onClick={handleDeleteSet}
                    className="copy-btn"
                    style={{ 
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    <Trash2 style={{ width: '16px', height: '16px' }} />
                    Delete Set
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="info-grid">
            {brokers.map((broker, idx) => (
              <div key={idx} className="info-card">
                <div className="card-header">
                  <h3>
                    <LinkIcon style={{ width: '20px', height: '20px', marginRight: '0.5rem' }} />
                    Broker {idx + 1}
                  </h3>
                  <div className="status-indicator" style={{ 
                    backgroundColor: broker.status ? `${getStatusColor(broker.status)}20` : 'rgba(71, 85, 105, 0.3)',
                    borderColor: broker.status ? `${getStatusColor(broker.status)}40` : 'rgba(71, 85, 105, 0.4)',
                    color: broker.status ? getStatusColor(broker.status) : '#94a3b8'
                  }}>
                    {getStatusIcon(broker.status)}
                    {broker.status || 'Not Connected'}
                  </div>
                </div>
				{/* ADD WARNING BANNER HERE FOR BROKER 1 */}
                {idx === 0 && (
                 <div className="parameters-warning-banner">
                  <AlertTriangle className="warning-icon" />
                  <div className="warning-text">
                    Make sure Broker1 have Gold Future's Available in their Symbol list
                  </div>
                 </div>
                )}

                <div className="account-list">
                  <div className="account-item">
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Server style={{ width: '16px', height: '16px' }} />
                        Terminal:
                      </strong>
                      <select
                        value={broker.terminal}
                        onChange={e => handleFieldChange(idx, 'terminal', e.target.value)}
                        className="modern-select"
                        style={{ width: '100%' }}
                      >
                        <option value="MT4">MT4</option>
                        <option value="MT5">MT5</option>
                      </select>
                    </label>
                  </div>

                  <div className="account-item">
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Building2 style={{ width: '16px', height: '16px' }} />
                        Broker Name:
                      </strong>
                      <input
                        type="text"
                        value={broker.brokerName}
                        onChange={e => handleFieldChange(idx, 'brokerName', e.target.value)}
                        maxLength={20}
                        placeholder="Enter broker name (e.g., Alpari)"
                        className="modern-input"
                      />
                    </label>
                  </div>

                  <div className="account-item">
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <User style={{ width: '16px', height: '16px' }} />
                        Account #:
                      </strong>
                      <input
                        type="text"
                        value={broker.accountNumber}
                        onChange={e => handleFieldChange(idx, 'accountNumber', e.target.value.replace(/\D/g, ''))}
                        maxLength={10}
                        placeholder="Enter account number"
                        className="modern-input"
                      />
                    </label>
                  </div>

                  <div className="account-item">
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Lock style={{ width: '16px', height: '16px' }} />
                        Password:
                      </strong>
                      <input
                        type="password"
                        value={broker.password}
                        onChange={e => handleFieldChange(idx, 'password', e.target.value)}
                        placeholder="Enter trading password"
                        className="modern-input"
                      />
                    </label>
                  </div>

                  <div className="account-item">
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Server style={{ width: '16px', height: '16px' }} />
                        Server Name:
                      </strong>
                      <input
                        type="text"
                        value={broker.serverNameInput}
                        onChange={e => handleFieldChange(idx, 'serverNameInput', e.target.value)}
                        placeholder="Enter server name"
                        className="modern-input"
                      />
                    </label>
                  </div>

                  {broker.error && (
                    <div style={{ 
                      marginTop: '1rem',
                      padding: '0.75rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      color: '#fca5a5',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <AlertCircle style={{ width: '16px', height: '16px' }} />
                      {broker.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="modern-selector-section">
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={handleLinkAndSave}
                disabled={saving || !validateForm() || !name.trim()}
                className="copy-btn"
                style={{ 
                  fontSize: '1.1rem',
                  padding: '1rem 2rem',
                  minWidth: '200px',
                  background: (saving || !validateForm() || !name.trim())
                    ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                }}
              >
                {saving ? 'Linking & Saving...' : 'Link & Save Accounts'}
              </button>
            </div>
          </div>

          {sets.length > 0 && (
            <div className="info-card">
              <div className="card-header">
                <h3>Your Linked Account Sets</h3>
                <div className="status-indicator online">
                  <div className="status-dot"></div>
                  {sets.length} Sets
                </div>
              </div>
              <div className="account-list">
                {sets.map((set, index) => (
                  <div key={set._id} className="account-item">
                    <div>
                      <strong>{set.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        {set.brokers.map((broker, idx) => (
                          <span key={idx}>
                            {broker.terminal}: {broker.server} (#{broker.accountNumber})
                            {idx < set.brokers.length - 1 && ' • '}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span style={{ 
                      backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                      color: '#60a5fa', 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: '600'
                    }}>
                      Set {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}