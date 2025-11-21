import React from 'react';

export default function DateRangePicker({ startDate, endDate, onChange }) {
  return (
    <div className="date-range-picker">
      <label>
        Từ ngày
        <input type="date" value={startDate} onChange={(e)=> onChange(e.target.value, endDate)} />
      </label>
      <span className="date-range-separator">→</span>
      <label>
        Đến ngày
        <input type="date" value={endDate} onChange={(e)=> onChange(startDate, e.target.value)} />
      </label>
    </div>
  );
}
