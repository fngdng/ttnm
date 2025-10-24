import React from 'react';

export default function DateRangePicker({ startDate, endDate, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      <label>From: <input type="date" value={startDate} onChange={(e)=> onChange(e.target.value, endDate)} /></label>
      <label>To: <input type="date" value={endDate} onChange={(e)=> onChange(startDate, e.target.value)} /></label>
    </div>
  );
}
