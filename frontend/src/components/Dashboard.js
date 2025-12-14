import React, { useState, useEffect, useCallback } from 'react';
import { socket } from '../services/socket';
import apiClient from '../services/api';
import ChartSummary from './ChartSummary';
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
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState({ name: '', type: '' });
  
  // Danh sách các nhóm
  const [expenseGroups] = useState(['Hóa đơn', 'Mua sắm', 'Bảo dưỡng xe', 'Sức khỏe', 'Thể thao', 'Giáo dục', 'Đầu tư', 'Giải trí', 'Ăn uống', 'Đi lại', 'Quần áo', 'Khác']);
  const [incomeGroups, setIncomeGroups] = useState(['Lương', 'Tiền chuyển đến', 'Thu lãi', 'Đầu tư', 'Thưởng', 'Kinh doanh', 'Cho thuê', 'Khác']);

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

  // Thêm class vào body để có background vàng nhạt
  useEffect(() => {
    document.body.classList.add('dashboard-active');
    return () => {
      document.body.classList.remove('dashboard-active');
    };
  }, []);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!selectedGroup.name || !selectedGroup.type) {
      alert('Vui lòng chọn nhóm');
      return;
    }
    
    const form = e.target;
    // Lưu tên nhóm vào description để biểu đồ có thể nhóm được
    // Nếu có ghi chú thì nối vào, không có thì chỉ lưu tên nhóm
    const note = form.description.value.trim();
    const description = note ? `${selectedGroup.name} - ${note}` : selectedGroup.name;
    
    const payload = {
      description: description,
      amount: form.amount.value,
      date: form.date.value,
      type: selectedGroup.type,
      categoryId: null 
    };

    try {
      await apiClient.post('/transactions', payload);
      form.reset();
      form.date.value = new Date().toISOString().split('T')[0];
      setSelectedGroup({ name: '', type: '' });
      setShowGroupDropdown(false);
      
      fetchAllData();
    } catch (error) {
      alert('Thêm giao dịch thất bại');
    }
  };

  const handleSelectGroup = (groupName, type) => {
    setSelectedGroup({ name: groupName, type });
    setShowGroupDropdown(false);
  };

  // Format description để hiển thị: "Tên nhóm - Ghi chú" hoặc chỉ "Tên nhóm"
  const formatTransactionDescription = (description) => {
    if (!description) return 'Không có mô tả';
    
    
    return description;
  };

  /**
   * Xử lý xuất file Excel
   */
  const handleExport = async () => {
    try {
      const { firstDay, lastDay } = range;
      const response = await apiClient.get(
        `/reports/export-excel?startDate=${firstDay}&endDate=${lastDay}`,
        { responseType: 'blob' } 
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
            <h3>Thêm giao dịch</h3>
            <span className="dashboard-panel__hint">Ghi lại khoản thu hoặc chi trong ngày</span>
          </div>
          <form onSubmit={handleAddTransaction} className="dashboard-form">
            <input name="description" type="text" placeholder="Ghi chú (không bắt buộc)" />
            <input name="amount" type="number" placeholder="Số tiền" required min="0" />
            <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
            
            {/* Dropdown Chọn nhóm */}
            <div 
              style={{ position: 'relative' }}
              onBlur={(e) => {
                
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setTimeout(() => setShowGroupDropdown(false), 200);
                }
              }}
            >
              <button
                type="button"
                onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: showGroupDropdown ? '1px solid #22c55e' : '1px solid #d4d9e2',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.95rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxShadow: showGroupDropdown ? '0 0 0 3px rgba(34, 197, 94, 0.25)' : 'none'
                }}
              >
                <span style={{ color: selectedGroup.name ? '#223044' : '#64748b' }}>
                  {selectedGroup.name || 'Chọn nhóm'}
                </span>
                <span style={{ fontSize: '0.8rem' }}>{showGroupDropdown ? '▲' : '▼'}</span>
              </button>
              
              {showGroupDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#fff',
                  border: '1px solid #d4d9e2',
                  borderRadius: '10px',
                  marginTop: '4px',
                  boxShadow: '0 8px 24px rgba(34, 48, 68, 0.15)',
                  zIndex: 1000,
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {/* Khoản chi */}
                  <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444', marginBottom: '6px' }}>
                      Khoản chi
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {expenseGroups.map((group) => (
                        <button
                          key={group}
                          type="button"
                          onClick={() => handleSelectGroup(group, 'expense')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #fecdd3',
                            backgroundColor: selectedGroup.name === group && selectedGroup.type === 'expense' ? '#fecdd3' : '#fff',
                            color: '#b91c1c',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontWeight: selectedGroup.name === group && selectedGroup.type === 'expense' ? 600 : 400
                          }}
                          onMouseEnter={(e) => {
                            if (!(selectedGroup.name === group && selectedGroup.type === 'expense')) {
                              e.target.style.backgroundColor = '#fef2f2';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!(selectedGroup.name === group && selectedGroup.type === 'expense')) {
                              e.target.style.backgroundColor = '#fff';
                            }
                          }}
                        >
                          {group}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Khoản thu */}
                  <div style={{ padding: '8px 12px', backgroundColor: '#f0fdf4', borderBottom: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#22c55e', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Khoản thu</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newGroup = prompt('Nhập tên nhóm mới:');
                          if (newGroup && newGroup.trim()) {
                            const trimmedGroup = newGroup.trim();
                            if (!incomeGroups.includes(trimmedGroup)) {
                              setIncomeGroups([...incomeGroups, trimmedGroup]);
                            }
                            handleSelectGroup(trimmedGroup, 'income');
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #86efac',
                          backgroundColor: '#dcfce7',
                          color: '#16a34a',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        + Thêm nhóm mới
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {incomeGroups.map((group) => (
                        <button
                          key={group}
                          type="button"
                          onClick={() => handleSelectGroup(group, 'income')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #86efac',
                            backgroundColor: selectedGroup.name === group && selectedGroup.type === 'income' ? '#86efac' : '#fff',
                            color: '#16a34a',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontWeight: selectedGroup.name === group && selectedGroup.type === 'income' ? 600 : 400
                          }}
                          onMouseEnter={(e) => {
                            if (!(selectedGroup.name === group && selectedGroup.type === 'income')) {
                              e.target.style.backgroundColor = '#f0fdf4';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!(selectedGroup.name === group && selectedGroup.type === 'income')) {
                              e.target.style.backgroundColor = '#fff';
                            }
                          }}
                        >
                          {group}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <button 
              type="submit" 
              className="dashboard-btn dashboard-btn--primary"
              style={{
                width: 'auto',
                minWidth: '160px',
                alignSelf: 'center',
                marginTop: '8px'
              }}
            >
              Thêm giao dịch
            </button>
          </form>
        </div>
      </div>

      <div className="dashboard-section">
          <ScanBills onSaved={() => fetchAllData()} />
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
                  <span className="dashboard-transaction-item__title">
                    {formatTransactionDescription(tx.description)}
                  </span>
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
} 

export default Dashboard;