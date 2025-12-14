import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import apiClient from '../services/api';

// Hàm format số với chữ cái (200M, 200K, etc.)
function formatNumber(value) {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(0)}B`;
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(0)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toFixed(0);
}

function getWeekInMonthKey(dateString) {
  const dt = new Date(dateString + 'T00:00:00');
  const year = dt.getFullYear();
  const month = dt.getMonth() + 1;
  const day = dt.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Chia thành 4 tuần
  let weekNum;
  const weekSize = Math.ceil(daysInMonth / 4);
  if (day <= weekSize) weekNum = 1;
  else if (day <= weekSize * 2) weekNum = 2;
  else if (day <= weekSize * 3) weekNum = 3;
  else weekNum = 4;
  
  const weekStart = (weekNum - 1) * weekSize + 1;
  const weekEnd = Math.min(weekNum * weekSize, daysInMonth);
  
  return {
    key: `${year}-${String(month).padStart(2,'0')}-W${weekNum}`,
    label: `T${weekNum} ${month}/${year}`,
    labelFull: `Tuần ${weekNum} (${weekStart}-${weekEnd}/${month}/${year})`,
    month: `${year}-${String(month).padStart(2,'0')}`,
    weekNum,
    year,
    monthNum: month,
    weekStart,
    weekEnd
  };
}


const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        backgroundColor: '#fff',
        padding: '14px 18px',
        border: '2px solid #22c55e',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(34, 197, 94, 0.3)',
        minWidth: '220px'
      }}>
        <div style={{ 
          fontWeight: 700, 
          color: '#166534',
          marginBottom: '10px',
          fontSize: '0.95rem',
          borderBottom: '1px solid #dcfce7',
          paddingBottom: '8px'
        }}>
          {data.labelFull || data.label}
        </div>
        {payload.map((entry, index) => (
          <div key={index} style={{ 
            color: entry.color, 
            fontWeight: 600,
            marginBottom: index < payload.length - 1 ? '8px' : '0',
            fontSize: '0.95rem'
          }}>
            <span style={{ opacity: 0.7, marginRight: '8px' }}>
              {entry.dataKey === 'income' ? '💰 Thu nhập' : '💸 Chi tiêu'}
            </span>
            <span style={{ float: 'right', fontWeight: 700 }}>
              {formatNumber(entry.value)} ₫
            </span>
          </div>
        ))}
        {data.expense && data.income && (
          <div style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #dcfce7',
            fontSize: '0.9rem',
            color: data.expense > data.income ? '#ef4444' : '#22c55e',
            fontWeight: 600
          }}>
            Số dư: {formatNumber(data.income - data.expense)} ₫
          </div>
        )}
      </div>
    );
  }
  return null;
};

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
          const weekInfo = getWeekInMonthKey(tx.date);
          const key = weekInfo.key;
          const prev = map.get(key) || { 
            key,
            label: weekInfo.label,
            labelFull: weekInfo.labelFull,
            month: weekInfo.month,
            weekNum: weekInfo.weekNum,
            year: weekInfo.year,
            monthNum: weekInfo.monthNum,
            income: 0, 
            expense: 0,
            transactionCount: 0
          };
          
          if (tx.type === 'income') {
            prev.income += Number(tx.amount || 0);
          } else {
            prev.expense += Number(tx.amount || 0);
          }
          prev.transactionCount += 1;
          map.set(key, prev);
        });
        
        
        const arr = Array.from(map.values())
          .map(item => ({
            ...item,
            income: Math.max(0, item.income || 0), // Đảm bảo không có giá trị âm
            expense: Math.max(0, item.expense || 0) // Đảm bảo không có giá trị âm
          }))
          .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            if (a.monthNum !== b.monthNum) return a.monthNum - b.monthNum;
            return a.weekNum - b.weekNum;
          });
        
        setData(arr);
      } catch (err) { 
        console.error('Lỗi tải lịch sử giao dịch:', err); 
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
          Đang tải lịch sử...
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
        Không có dữ liệu lịch sử trong khoảng thời gian này.
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100%', 
      height: 420, 
      marginTop: 20,
      backgroundColor: '#f0fdf4',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(34, 197, 94, 0.15)'
    }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart 
          data={data} 
          margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
          allowDataOverflow={false}
        >
          <defs>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4}/>
              <stop offset="50%" stopColor="#22c55e" stopOpacity={0.2}/>
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05}/>
            </linearGradient>
            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4}/>
              <stop offset="50%" stopColor="#ef4444" stopOpacity={0.2}/>
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#86efac" opacity={0.4} />
          <XAxis 
            dataKey="label" 
            stroke="#166534"
            angle={-45}
            textAnchor="end"
            height={80}
            style={{ fontSize: '0.75rem', fontWeight: 500 }}
            interval={0}
          />
          <YAxis 
            stroke="#166534"
            style={{ fontSize: '0.85rem', fontWeight: 500 }}
            tickFormatter={(value) => formatNumber(value)}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Đường thẳng dọc tại mỗi điểm thống kê - làm mềm hơn */}
          {data.map((item, index) => (
            <ReferenceLine
              key={`ref-${index}`}
              x={item.label}
              stroke="#86efac"
              strokeWidth={1}
              strokeOpacity={0.3}
            />
          ))}
          
          {/* Thu nhập - Area chart với đường cong mềm mại */}
          <Area
            type="natural"
            dataKey="income"
            stroke="#22c55e"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorIncome)"
            baseValue={0}
            dot={false}
            activeDot={{ 
              r: 5, 
              stroke: '#22c55e', 
              strokeWidth: 2, 
              fill: '#fff',
              strokeDasharray: '0'
            }}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive={true}
            animationDuration={300}
          />
          
          {/* Chi tiêu - Area chart với đường cong mềm mại */}
          <Area
            type="natural"
            dataKey="expense"
            stroke="#ef4444"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorExpense)"
            baseValue={0}
            dot={false}
            activeDot={{ 
              r: 5, 
              stroke: '#ef4444', 
              strokeWidth: 2, 
              fill: '#fff',
              strokeDasharray: '0'
            }}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive={true}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
      
      {/* Legend tự tạo để rõ ràng hơn */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        marginTop: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '16px',
            height: '16px',
            backgroundColor: '#22c55e',
            borderRadius: '4px'
          }}></div>
          <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 500 }}>Thu nhập</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '16px',
            height: '16px',
            backgroundColor: '#ef4444',
            borderRadius: '4px'
          }}></div>
          <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 500 }}>Chi tiêu</span>
        </div>
      </div>
    </div>
  );
}
