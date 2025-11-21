import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import apiClient from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A020F0', '#FF4560'];

export default function ChartSummary({ startDate, endDate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/reports/by-category?startDate=${startDate}&endDate=${endDate}&type=expense`);
        const normalized = res.data.map(item => ({
          name: item.Category ? item.Category.name : (item.name || `Danh mục ${item.categoryId}`),
          value: Number(item.totalAmount || item.totalAmount || 0)
        }));
        setData(normalized);
      } catch (err) {
        console.error('Lỗi tải báo cáo danh mục:', err);
      } finally {
        setLoading(false);
      }
    };
    if (startDate && endDate) fetch();
  }, [startDate, endDate]);

  if (loading) return <div>Đang tải biểu đồ...</div>;
  if (!data || data.length === 0) return <div>Không có dữ liệu chi tiêu trong khoảng thời gian này.</div>;

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie dataKey="value" data={data} outerRadius={100} label>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
