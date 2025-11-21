import React, { useEffect, useState } from 'react';
import apiClient from '../services/api';
import { useToast } from './ToastProvider';

export default function TransactionModal({ open, transaction, onClose, onSaved }) {
  const [form, setForm] = useState({ description: '', amount: '', date: '', type: 'expense' });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (transaction) {
      setForm({
        description: transaction.description || '',
        amount: transaction.amount || '',
        date: transaction.date || new Date().toISOString().split('T')[0],
        type: transaction.type || 'expense'
      });
    }
  }, [transaction]);

  if (!open) return null;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (transaction && transaction.id) {
        await apiClient.put(`/transactions/${transaction.id}`, form);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Lỗi lưu giao dịch:', err);
      toast.push('Lưu giao dịch thất bại', 'error');
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!transaction || !transaction.id) return;
    if (!window.confirm('Xóa giao dịch này?')) return;
    setLoading(true);
    try {
      await apiClient.delete(`/transactions/${transaction.id}`);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Lỗi xóa giao dịch:', err);
      toast.push('Xóa giao dịch thất bại', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <form onSubmit={handleSave} style={{ background: 'white', padding: 20, borderRadius: 8, minWidth: 320 }}>
        <h3>Giao dịch</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input name="description" value={form.description} onChange={handleChange} placeholder="Mô tả" style={{ padding: 8 }} />
          <input name="amount" type="number" value={form.amount} onChange={handleChange} placeholder="Số tiền" style={{ padding: 8 }} />
          <input name="date" type="date" value={form.date} onChange={handleChange} style={{ padding: 8 }} />
          <select name="type" value={form.type} onChange={handleChange} style={{ padding: 8 }}>
            <option value="expense">Chi tiêu</option>
            <option value="income">Thu nhập</option>
          </select>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}>Đóng</button>
          {transaction && transaction.id && <button type="button" onClick={handleDelete} style={{ color: 'red' }}>Xóa</button>}
          <button type="submit" disabled={loading} style={{ background: '#007bff', color: 'white', border: 'none', padding: '8px 12px' }}>{loading ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </form>
    </div>
  );
}
