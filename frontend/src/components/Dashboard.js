import React, { useState, useEffect, useCallback } from 'react';
import { socket } from '../services/socket';
import apiClient from '../services/api';
import ChartSummary from './ChartSummary';
import Categories from './Categories';
import HistoryChart from './HistoryChart';
import DateRangePicker from './DateRangePicker';
import TransactionModal from './TransactionModal';
import ScanBills from './ScanBills';
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

  const fetchAllData = useCallback(async () => {
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
  }, [range]);

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
  }, [user.id, fetchAllData]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

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
      // Tải lại dữ liệu để cập nhật số tiền
      fetchAllData();
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
    const limitClass = remaining >= 0 ? 'dashboard-alert__item--positive' : 'dashboard-alert__item--negative';
    const trendClass = vsLastMonth > 0 ? 'dashboard-alert__item--negative' : 'dashboard-alert__item--positive';
    
    return (
      <div className="dashboard-alert">
        <h4>Thông báo chi tiêu</h4>
        {summary.monthlyLimit > 0 ? (
          remaining >= 0 ? (
            <p className={`dashboard-alert__item ${limitClass}`}><span className="dashboard-alert__icon">✅</span> Bạn còn <strong>{formatCurrency(remaining)}</strong> trước khi chạm hạn mức.</p>
          ) : (
            <p className={`dashboard-alert__item ${limitClass}`}><span className="dashboard-alert__icon">🔥</span> <strong>Cảnh báo:</strong> Bạn đã chi vượt hạn mức <strong>{formatCurrency(Math.abs(remaining))}</strong>!</p>
          )
        ) : (
          <p className="dashboard-alert__item dashboard-alert__item--neutral"><i>Bạn chưa đặt hạn mức. Hãy mở trang Cài đặt để thiết lập ngay.</i></p>
        )}
        
        {vsLastMonth > 0 ? (
          <p className={`dashboard-alert__item ${trendClass}`}><span className="dashboard-alert__icon">📉</span> Tháng này bạn đã chi <strong>nhiều hơn</strong> tháng trước {formatCurrency(vsLastMonth)}.</p>
        ) : (
          <p className={`dashboard-alert__item ${trendClass}`}><span className="dashboard-alert__icon">📈</span> Tháng này bạn đã chi <strong>ít hơn</strong> tháng trước {formatCurrency(Math.abs(vsLastMonth))}.</p>
        )}
      </div>
    );
  };

  
  return (
    <div className="dashboard-container">
      {notification && <div className="dashboard-notification">{notification}</div>}
      
      <div className="dashboard-hero">
        <div className="dashboard-hero__text">
          <p className="dashboard-hero__greeting">Xin chào, <strong>{user.username}</strong> 👋</p>
          <h1>Trang tổng quan tài chính</h1>
          <p className="dashboard-hero__subtitle">Theo dõi thu chi, kiểm soát hạn mức và từng bước chạm tới mục tiêu tài chính.</p>
        </div>
        <div className="dashboard-hero__actions">
          <button className="dashboard-btn dashboard-btn--ghost" onClick={() => onOpenSettings && onOpenSettings()}>Cài đặt hạn mức</button>
          <button className="dashboard-btn dashboard-btn--danger" onClick={onLogout}>Đăng xuất</button>
        </div>
      </div>
      
      <div className="dashboard-section">
        <div className="dashboard-section__header">
          <h3>Tổng quan nhanh</h3>
          <DateRangePicker startDate={range.firstDay} endDate={range.lastDay} onChange={(s,e)=> setRange({ firstDay: s, lastDay: e })} />
        </div>
        
        <ChartSummary startDate={range.firstDay} endDate={range.lastDay} />
        
        <div className="dashboard-summary-grid">
          <div className="dashboard-summary-card dashboard-summary-card--income">
            <span className="dashboard-summary-card__label">Tổng thu</span>
            <span className="dashboard-summary-card__value">{formatCurrency(summary.totalIncome)}</span>
          </div>
          <div className="dashboard-summary-card dashboard-summary-card--expense">
            <span className="dashboard-summary-card__label">Tổng chi</span>
            <span className="dashboard-summary-card__value">{formatCurrency(summary.totalExpense)}</span>
          </div>
          <div className="dashboard-summary-card dashboard-summary-card--balance">
            <span className="dashboard-summary-card__label">Số dư</span>
            <span className="dashboard-summary-card__value">{formatCurrency(summary.netBalance)}</span>
          </div>
        </div>
      </div>

      {renderAlerts()}

      <div className="dashboard-panel-grid">
        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <h3>Xu hướng thu - chi</h3>
            <span className="dashboard-panel__hint">Số liệu theo tháng</span>
          </div>
          <HistoryChart startDate={range.firstDay} endDate={range.lastDay} />
        </div>
        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <h3>Danh mục chi tiêu</h3>
            <span className="dashboard-panel__hint">Cập nhật và sắp xếp danh mục</span>
          </div>
          <Categories onChange={() => fetchAllData()} />
        </div>
      </div>

      <div className="dashboard-section">
        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <h3>Thêm giao dịch</h3>
            <span className="dashboard-panel__hint">Ghi lại khoản thu hoặc chi trong ngày</span>
          </div>
          <form onSubmit={handleAddTransaction} className="dashboard-form">
            <input name="description" type="text" placeholder="Mô tả" required minLength={2} />
            <input name="amount" type="number" placeholder="Số tiền" required min="0" />
            <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
            <select name="type">
              <option value="expense">Chi tiêu</option>
              <option value="income">Thu nhập</option>
            </select>
            <button type="submit" className="dashboard-btn dashboard-btn--primary">Thêm giao dịch</button>
          </form>
        </div>
      </div>

      <div className="dashboard-section">
        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <h3>Quét hoá đơn / biên lai</h3>
            <span className="dashboard-panel__hint">Tải ảnh hoá đơn để tự động trích xuất thông tin</span>
          </div>
          <ScanBills onSaved={() => fetchAllData()} />
        </div>
      </div>

      <div className="dashboard-section">
        <div className="dashboard-panel">
          <div className="dashboard-section__header">
            <h3>Giao dịch gần đây</h3>
            <button onClick={handleExport} className="dashboard-btn dashboard-btn--success">
              Xuất Excel (tháng này)
            </button>
          </div>
          <ul className="dashboard-transaction-list">
            {transactions.map(tx => (
              <li key={tx.id} onClick={() => { setSelectedTx(tx); setModalOpen(true); }} className="dashboard-transaction-item">
                <div className="dashboard-transaction-item__info">
                  <span className="dashboard-transaction-item__title">{tx.description || 'Không có mô tả'}</span>
                  <span className="dashboard-transaction-item__date">{tx.date}</span>
                </div>
                <span className={`dashboard-transaction-item__amount ${tx.type === 'expense' ? 'is-expense' : 'is-income'}`}>
                  {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <TransactionModal open={modalOpen} transaction={selectedTx} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); fetchAllData(); }} />
    </div>
  );
} // <-- Dấu ngoặc kết thúc component ở đây

export default Dashboard;