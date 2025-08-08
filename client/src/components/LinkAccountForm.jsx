// src/components/LinkAccountForm.jsx

import React, { useState } from 'react';

/**
 * LinkAccountForm
 *
 * A form to link two broker accounts (Broker 1 & Broker 2) via MT4/MT5 APIs,
 * then persist the returned session tokens in our own backend.
 */
export default function LinkAccountForm() {
  const [brokers, setBrokers] = useState({
    broker1: { terminal: '', accountNumber: '', password: '', server: '' },
    broker2: { terminal: '', accountNumber: '', password: '', server: '' },
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Update a single field; enforce numeric‐only on accountNumber
  const handleChange = (brokerKey, field) => e => {
    let value = e.target.value;
    if (field === 'accountNumber') {
      value = value.replace(/\D/g, '');
    }
    setBrokers(prev => ({
      ...prev,
      [brokerKey]: { ...prev[brokerKey], [field]: value }
    }));
  };

  // All fields required, and terminal must be MT4 or MT5
  const validate = () => {
    return ['broker1', 'broker2'].every(key => {
      const b = brokers[key];
      return ['MT4', 'MT5'].includes(b.terminal)
        && b.accountNumber !== ''
        && b.password.trim() !== ''
        && b.server.trim() !== '';
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) {
      alert('Please complete all fields with valid values.');
      return;
    }
    setLoading(true);
    try {
      // 1) Call external /linkAccount for both brokers
      const responses = await Promise.all(
        ['broker1', 'broker2'].map(async key => {
          const { terminal, accountNumber, password, server } = brokers[key];
          const baseUrl =
            terminal === 'MT4'
              ? process.env.REACT_APP_MT4_API_URL
              : process.env.REACT_APP_MT5_API_URL;
          const res = await fetch(`${baseUrl}/linkAccount`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountNumber, password, server })
          });
          const data = await res.json();
          return { broker: key, terminal, success: res.ok, data };
        })
      );

      setResult(responses);

      // 2) Persist each returned token to our own backend
      await Promise.all(
        responses.map(async r => {
          if (r.success && r.data.token) {
            await fetch('/api/users/account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                terminal: r.terminal,
                token: r.data.token
              })
            });
          }
        })
      );

      // (Optionally, you can re-fetch GET /api/users/me here
      //  or update your global context so other pages see the new tokens.)

    } catch (err) {
      console.error('Linking error:', err);
      alert('Failed to link accounts. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4">
      {['broker1', 'broker2'].map((key, idx) => (
        <fieldset key={key} className="border p-4 rounded">
          <legend className="font-bold">Broker {idx + 1}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col">
              Terminal
              <select
                value={brokers[key].terminal}
                onChange={handleChange(key, 'terminal')}
                required
                className="mt-1 border rounded p-1"
              >
                <option value="">Select MT4/MT5</option>
                <option value="MT4">MT4</option>
                <option value="MT5">MT5</option>
              </select>
            </label>
            <label className="flex flex-col">
              Account Number
              <input
                type="text"
                value={brokers[key].accountNumber}
                onChange={handleChange(key, 'accountNumber')}
                pattern="\d*"
                required
                className="mt-1 border rounded p-1"
              />
            </label>
            <label className="flex flex-col">
              Trading Password
              <input
                type="password"
                value={brokers[key].password}
                onChange={handleChange(key, 'password')}
                required
                className="mt-1 border rounded p-1"
              />
            </label>
            <label className="flex flex-col">
              Server Name
              <input
                type="text"
                value={brokers[key].server}
                onChange={handleChange(key, 'server')}
                required
                className="mt-1 border rounded p-1"
              />
            </label>
          </div>
        </fieldset>
      ))}
      <button
        type="submit"
        disabled={!validate() || loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Linking…' : 'Link Accounts'}
      </button>

      {result && (
        <pre className="mt-4 bg-gray-100 p-2 rounded text-sm overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </form>
  );
}
