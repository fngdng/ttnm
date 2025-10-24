import React, { useState, useEffect } from 'react';
import { socket } from '../services/socket';
import apiClient from '../services/api';
import ChartSummary from './ChartSummary';
import Categories from './Categories';
import HistoryChart from './HistoryChart';
import DateRangePicker from './DateRangePicker';
import TransactionModal from './TransactionModal';
import './dashboard.css';

const formatCurrency = (num) => {
  const n = Number(num) || 0;
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
};
const getMonthRange = () => {
  const date = new Date(), y = date.getFullYear(), m = date.getMonth();
  const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
  const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
  return { firstDay, lastDay };
};
const downloadFile = (blobData, filename) => {
  const url = window.URL.createObjectURL(new Blob([blobData]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};


function Dashboard({ user, onLogout, onOpenSettings }) {
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    monthlyLimit: 0,
    lastMonthExpense: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [notification, setNotification] = useState('');
  const [range, setRange] = useState(() => getMonthRange());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  const fetchAllData = async () => {
    try {
      const { firstDay, lastDay } = range;
      const [summaryRes, transactionsRes] = await Promise.all([
        apiClient.get(`/reports/summary?startDate=${firstDay}&endDate=${lastDay}`),
        apiClient.get(`/transactions?startDate=${firstDay}&endDate=${lastDay}&limit=10&page=1`)
      ]);
      
      setSummary(summaryRes.data);
      setTransactions(transactionsRes.data.transactions);
    } catch (error) {
      console.error('Lỗi tải dữ liệu:', error);
    }
  };

  useEffect(() => {
    fetchAllData();
    socket.connect();
    socket.emit('join_room', user.id);

    socket.on('transaction_updated', (payload) => {
      if (payload.userId === user.id) {
        setNotification('Có cập nhật mới, đang tải lại...');
        fetchAllData();
        setTimeout(() => setNotification(''), 2000);
      }
    });

    return () => {
      socket.off('transaction_updated');
      socket.disconnect();
    };
  }, [user.id]);

  useEffect(() => { fetchAllData(); }, [range]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      description: form.description.value,
      amount: form.amount.value,
      date: form.date.value,
      type: form.type.value,
      categoryId: null // Bỏ qua category cho đơn giản
    };

    try {
      await apiClient.post('/transactions', payload);
      form.reset();
      
      form.date.value = new Date().toISOString().split('T')[0];
    } catch (error) {
      alert('Thêm giao dịch thất bại');
    }
  };

  /**
   * Xử lý xuất file Excel
   */
  const handleExport = async () => {
    try {
      const { firstDay, lastDay } = range;
      const response = await apiClient.get(
        `/reports/export-excel?startDate=${firstDay}&endDate=${lastDay}`,
        { responseType: 'blob' } // Yêu cầu response là file
      );
      
      downloadFile(response.data, `ChiTieu_Thang_${new Date().getMonth()+1}.xlsx`);
      
    } catch (error) {
      console.error('Lỗi xuất Excel:', error);
      alert('Không thể xuất file.');
    }
  };

  /**
   * Render các thông báo chi tiêu
   */
  const renderAlerts = () => {
    
    const remaining = summary.monthlyLimit - summary.totalExpense;
    const vsLastMonth = summary.totalExpense - summary.lastMonthExpense;
    
    return (
      <div style={{ background: '#f4f7f6', padding: '15px', borderRadius: 8, marginTop: '20px' }}>
        <h4>Thông báo Chi tiêu</h4>
        {summary.monthlyLimit > 0 ? (
          remaining >= 0 ? (
            <p style={{ color: 'green' }}>✅ Bạn còn <strong>{formatCurrency(remaining)}</strong> trước khi chạm hạn mức.</p>
          ) : (
            <p style={{ color: 'red' }}>🔥 <strong>CẢNH BÁO:</strong> Bạn đã chi vượt hạn mức <strong>{formatCurrency(Math.abs(remaining))}</strong>!</p>
          )
        ) : (
          <p><i>Bạn chưa đặt hạn mức. (Vào Cài đặt)</i></p>
        )}
        
        {vsLastMonth > 0 ? (
          <p>📉 Tháng này bạn đã chi <strong>nhiều hơn</strong> tháng trước {formatCurrency(vsLastMonth)}.</p>
        ) : (
          <p>📈 Tháng này bạn đã chi <strong>ít hơn</strong> tháng trước {formatCurrency(Math.abs(vsLastMonth))}.</p>
        )}
      </div>
    );
  };

  
  return (
    <div style={{ maxWidth: 900, margin: '20px auto', padding: 20 }}>
      {notification && <div style={{ padding: 10, background: '#fff8e1', textAlign: 'center', fontWeight: 'bold' }}>{notification}</div>}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Xin chào, {user.username}!</h2>
        <div>
          <button onClick={() => onOpenSettings && onOpenSettings()} style={{ marginRight: 8 }}>Cài đặt</button>
          <button onClick={onLogout} style={{ marginLeft: 10 }}>Đăng xuất</button>
        </div>
      </div>
      
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Tóm tắt</h3>
        <DateRangePicker startDate={range.firstDay} endDate={range.lastDay} onChange={(s,e)=> setRange({ firstDay: s, lastDay: e })} />
      </div>
      
      <ChartSummary startDate={range.firstDay} endDate={range.lastDay} />
  <div style={{ display: 'flex', gap: 15, justifyContent: 'space-around' }}>
         <div style={{ padding: 15, border: '1px solid #ccc', borderRadius: 5, textAlign: 'center', flex: 1 }}>
          <h4 style={{ margin: 0, color: 'green' }}>Tổng Thu</h4>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>{formatCurrency(summary.totalIncome)}</p>
        </div>
        <div style={{ padding: 15, border: '1px solid #ccc', borderRadius: 5, textAlign: 'center', flex: 1 }}>
          <h4 style={{ margin: 0, color: 'red' }}>Tổng Chi</h4>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>{formatCurrency(summary.totalExpense)}</p>
        </div>
        <div style={{ padding: 15, border: '1px solid #ccc', borderRadius: 5, textAlign: 'center', flex: 1 }}>
          <h4 style={{ margin: 0, color: 'blue' }}>Số dư</h4>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>{formatCurrency(summary.netBalance)}</p>
        </div>
      </div>

  {renderAlerts()}
  <HistoryChart startDate={range.firstDay} endDate={range.lastDay} />
  <Categories onChange={() => fetchAllData()} />

  <Categories />
      
      
      <hr style={{ margin: '20px 0' }} />
      <h3>Thêm Giao dịch</h3>
      <form onSubmit={handleAddTransaction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input name="description" type="text" placeholder="Mô tả" required style={{ padding: 8 }} />
        <input name="amount" type="number" placeholder="Số tiền" required style={{ padding: 8 }} min="0" />
        <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} style={{ padding: 8 }} />
        <select name="type" style={{ padding: 8 }}>
          <option value="expense">Chi tiêu</option>
          <option value="income">Thu nhập</option>
        </select>
        <button type="submit" style={{ padding: 10, background: '#007bff', color: 'white', border: 'none' }}>Thêm</button>
      </form>
      
      
      <hr style={{ margin: '20px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Giao dịch gần đây</h3>
        <button onClick={handleExport} style={{background: '#1D6F42', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 5}}>
          Xuất Excel (Tháng này)
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {transactions.map(tx => (
          <li key={tx.id} onClick={() => { setSelectedTx(tx); setModalOpen(true); }} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, borderBottom: '1px solid #eee', cursor: 'pointer' }}>
            <span>{tx.description || '(Không mô tả)'} <em style={{ fontSize: '0.9em', color: '#555' }}>({tx.date})</em></span>
            <span style={{ fontWeight: 'bold', color: tx.type === 'expense' ? 'red' : 'green' }}>
              {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
            </span>
          </li>
        ))}
      </ul>
      <TransactionModal open={modalOpen} transaction={selectedTx} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); fetchAllData(); }} />
    </div>
  );
} // <-- Dấu ngoặc kết thúc component ở đây

export default Dashboard;