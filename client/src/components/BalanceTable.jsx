import React from 'react';
import './BalanceTable.css';

export default function BalanceTable({ balance, error }) {
  if (error) return <p className="error">{error}</p>;
  if (!balance) return <p>Loading balance…</p>;

  return (
    <table className="balance-table">
      <tbody>
        {Object.entries(balance).map(([key, val]) => (
          <tr key={key}>
            <td className="label">{key.replace(/([A-Z])/g, ' $1')}</td>
            <td className={typeof val === 'number' && val < 0 ? 'negative' : ''}>
              {val}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
