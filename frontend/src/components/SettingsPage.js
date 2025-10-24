import React, { useState } from 'react';
import apiClient from '../services/api';
import { useToast } from './ToastProvider';

function SettingsPage({ isFirstTime = false, onLimitSet }) {
  const [limit, setLimit] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
      try {
      const token = localStorage.getItem('jwtToken');
      if (!token) {
        setError('Bạn chưa đăng nhập. Vui lòng đăng nhập trước khi cập nhật hạn mức.');
        return;
      }

      const numericLimit = Number(limit);
      const response = await apiClient.put('/users/limit', { limit: numericLimit });
      setMessage(response.data.message);
      
      
      
      if (isFirstTime) {
        onLimitSet(response.data.newLimit);
      }
      
    } catch (err) {
      console.error('Settings update error', err);
      const serverMsg = err.response?.data?.message;
      const status = err.response?.status;
      const final = serverMsg ? `${serverMsg}` : `Lỗi cập nhật${status ? ` (HTTP ${status})` : ''}`;
      setError(final);
  toast.push(final, 'error');
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '50px auto', padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      
      {isFirstTime ? (
        <>
          <h2>Chào mừng bạn mới!</h2>
          <p>Hãy bắt đầu bằng cách đặt hạn mức chi tiêu tối đa hàng tháng của bạn.</p>
        </>
      ) : (
        <h2>Cài đặt Hạn mức</h2>
      )}
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <label htmlFor="limit">Hạn mức chi tiêu tháng (VND)</label>
        <input
          id="limit"
          type="number"
          placeholder="e.g., 5000000"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          style={{ padding: 10 }}
          min="0"
          required
        />
        
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p style={{ color: 'green' }}>{message}</p>}
        
        <button type="submit" style={{ padding: 10, background: '#007bff', color: 'white', border: 'none', borderRadius: 5 }}>
          {isFirstTime ? 'Bắt đầu' : 'Cập nhật'}
        </button>
      </form>
      
      {!isFirstTime && (
         <p style={{marginTop: '20px', fontSize: '0.9em'}}><i>* Bạn có thể quay lại trang Dashboard (nếu đã ở đó)</i></p>
      )}
    </div>
  );
}

export default SettingsPage;