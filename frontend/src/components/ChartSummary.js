import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import apiClient from '../services/api';



const COLORS = [
  '#22c55e', // Xanh lá đậm
  '#3b82f6', // Xanh dương
  '#f59e0b', // Vàng cam
  '#ef4444', // Đỏ
  '#8b5cf6', // Tím
  '#ec4899', // Hồng
  '#06b6d4', // Xanh lam
  '#10b981', // Xanh lá nhạt
  '#f97316', // Cam
  '#6366f1', // Xanh tím
  '#14b8a6', // Xanh ngọc
  '#84cc16', // Xanh chanh
  '#eab308', // Vàng
  '#f43f5e', // Đỏ hồng
  '#0ea5e9', // Xanh dương sáng
];


// Custom Tooltip component factory
const createCustomTooltip = (totalAmount) => {
  return ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const value = data.value || 0;
      
      // Tính phần trăm dựa trên tổng
      const percentage = totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(1) : 0;
      
      return (
        <div style={{
          backgroundColor: '#fff',
          padding: '12px 16px',
          border: '2px solid #22c55e',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(34, 197, 94, 0.25)',
          minWidth: '180px'
        }}>
          <div style={{ 
            fontWeight: 600, 
            color: '#166534',
            marginBottom: '6px',
            fontSize: '0.95rem'
          }}>
            {data.name || 'Chưa phân loại'}
          </div>
          <div style={{ 
            fontSize: '1.2rem', 
            fontWeight: 700, 
            color: '#22c55e',
            marginBottom: '4px'
          }}>
            {new Intl.NumberFormat('vi-VN').format(value)} ₫
          </div>
          <div style={{ 
            fontSize: '0.85rem', 
            color: '#64748b' 
          }}>
            {percentage}% tổng chi tiêu
          </div>
        </div>
      );
    }
    return null;
  };
};


const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null; 
  
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text 
      x={x} 
      y={y} 
      fill="#166534" 
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central"
      style={{ 
        fontSize: '0.85rem', 
        fontWeight: 600,
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
      }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function ChartSummary({ startDate, endDate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        // Lấy tất cả transactions chi tiêu trong khoảng thời gian
        const res = await apiClient.get(`/transactions?startDate=${startDate}&endDate=${endDate}&type=expense&limit=1000`);
        
        const transactions = res.data?.transactions || res.data || [];
        
        if (!Array.isArray(transactions) || transactions.length === 0) {
          setData([]);
          return;
        }

        // Group transactions theo tên nhóm (khoản chi)
        // Description có format: "Tên nhóm - Ghi chú" hoặc chỉ "Tên nhóm"
        const grouped = new Map();
        
        transactions.forEach(tx => {
          let groupName = 'Chưa phân loại';
          
          if (tx.description && tx.description.trim()) {
            const desc = tx.description.trim();
            
            // Luôn luôn lấy phần trước dấu " - " làm tên nhóm
            // Format: "Tên nhóm - Ghi chú" → lấy "Tên nhóm"
            // Format: "Tên nhóm" → lấy "Tên nhóm"
            const parts = desc.split(' - ');
            groupName = parts[0].trim() || desc.trim() || 'Chưa phân loại';
          }
          
          // Lấy số tiền
          const amount = parseFloat(tx.amount) || 0;
          
          if (amount > 0) {
            // Cộng dồn vào nhóm
            const currentTotal = grouped.get(groupName) || 0;
            grouped.set(groupName, currentTotal + amount);
          }
        });

        // Chuyển đổi Map thành Array và format dữ liệu
        const normalized = Array.from(grouped.entries())
          .map(([name, value]) => ({
            name: name,
            value: Math.round(value * 100) / 100 // Làm tròn 2 chữ số thập phân
          }))
          .filter(item => item.value > 0) // Chỉ lấy các mục có giá trị > 0
          .sort((a, b) => b.value - a.value); // Sắp xếp theo giá trị giảm dần
        
        setData(normalized);
      } catch (err) {
        console.error('Lỗi tải dữ liệu chi tiêu:', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    if (startDate && endDate) fetch();
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: 350,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0fdf4',
        borderRadius: '18px',
        border: '2px dashed #86efac'
      }}>
        <div style={{ 
          color: '#16a34a', 
          fontSize: '1.1rem',
          fontWeight: 600
        }}>
          Đang tải biểu đồ...
        </div>
      </div>
    );
  }
  
  if (!data || data.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: 350,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0fdf4',
        borderRadius: '18px',
        border: '2px dashed #86efac',
        color: '#64748b',
        fontSize: '1rem'
      }}>
        Không có dữ liệu chi tiêu trong khoảng thời gian này.
      </div>
    );
  }

  // Tính tổng chi tiêu
  const totalAmount = data.reduce((sum, item) => sum + (item.value || 0), 0);
  
  return (
    <div style={{ 
      width: '100%', 
      backgroundColor: '#f0fdf4',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(34, 197, 94, 0.15)'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '1.2rem', 
          fontWeight: 700, 
          color: '#166534',
          marginBottom: '4px'
        }}>
          Phân bổ chi tiêu
        </h3>
        <div style={{ 
          fontSize: '0.9rem', 
          color: '#64748b' 
        }}>
          Tổng chi tiêu: <strong style={{ color: '#ef4444' }}>
            {new Intl.NumberFormat('vi-VN').format(totalAmount)} ₫
          </strong>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <PieChart>
          <Pie 
            dataKey="value" 
            data={data} 
            cx="50%" 
            cy="50%"
            outerRadius={120}
            innerRadius={50}
            paddingAngle={3}
            label={renderCustomLabel}
            labelLine={false}
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]}
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.target.style.filter = 'brightness(1.1) drop-shadow(0 4px 8px rgba(34, 197, 94, 0.3))';
                }}
                onMouseLeave={(e) => {
                  e.target.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))';
                }}
              />
            ))}
          </Pie>
          <Tooltip content={createCustomTooltip(totalAmount)} />
          <Legend 
            wrapperStyle={{ 
              paddingTop: '20px',
              fontSize: '0.9rem'
            }}
            iconType="circle"
            formatter={(value, entry) => (
              <span style={{ color: '#166534', fontWeight: 500 }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
