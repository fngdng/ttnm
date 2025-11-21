import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import apiClient from '../services/api';

function getMonthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
}

export default function HistoryChart({ startDate, endDate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/transactions?startDate=${startDate}&endDate=${endDate}&limit=1000`);
        const txs = res.data.transactions || [];
        const map = new Map();
        txs.forEach(tx => {
          const key = getMonthKey(tx.date);
          const prev = map.get(key) || { month: key, income: 0, expense: 0 };
          if (tx.type === 'income') prev.income += Number(tx.amount || 0);
          else prev.expense += Number(tx.amount || 0);
          map.set(key, prev);
        });
  const arr = Array.from(map.values()).sort((a,b)=> a.month.localeCompare(b.month));
        setData(arr);
      } catch (err) { console.error('Lỗi tải lịch sử giao dịch:', err); }
      finally { setLoading(false); }
    };
    if (startDate && endDate) fetch();
  }, [startDate, endDate]);

  if (loading) return <div>Đang tải lịch sử...</div>;
  if (!data || data.length === 0) return <div>Không có dữ liệu lịch sử trong khoảng thời gian này.</div>;

  return (
    <div style={{ width: '100%', height: 300, marginTop: 20 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="income" stroke="#00C49F" />
          <Line type="monotone" dataKey="expense" stroke="#FF4560" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
