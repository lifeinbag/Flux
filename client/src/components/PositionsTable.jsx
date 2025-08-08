import React from 'react';
import './PositionTable.css';

export default function PositionTable({ positions, error }) {
  if (error) return <p className="error">{error}</p>;
  if (!positions.length) return <p>No open positions.</p>;

  return (
    <table className="positions-table">
      <thead>
        <tr>
          <th>Ticket</th>
          <th>Symbol</th>
          <th>Open Price</th>
          <th>Lots</th>
          <th>Profit</th>
        </tr>
      </thead>
      <tbody>
        {positions.map(o => (
          <tr key={o.ticket}>
            <td>{o.ticket}</td>
            <td>{o.symbol}</td>
            <td>{o.openPrice}</td>
            <td>{o.lots}</td>
            <td className={o.profit < 0 ? 'negative' : 'positive'}>
              {o.profit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
