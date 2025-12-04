import React, { useEffect, useState } from 'react';
import apiClient from '../services/api';
import { useToast } from './ToastProvider';


export default function TransactionModal({ open, transaction, prefill, onClose, onSaved }) {
  const [form, setForm] = useState({ description: '', amount: '', date: '', type: 'expense' });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // When modal opens or transaction prop changes, populate the form.
    if (open && (transaction || prefill)) {
      try {
        // Prefer non-empty prefill values from scanner over existing transaction values.
        const pick = (prefVal, txVal) => {
          if (prefVal === undefined || prefVal === null) return txVal;
          if (typeof prefVal === 'string' && prefVal.trim() === '') return txVal;
          return prefVal;
        };

        const amountSrc = pick(prefill && prefill.amount, transaction && transaction.amount);
        const dateSrc = pick(prefill && prefill.date, transaction && transaction.date);
        const descSrc = pick(prefill && prefill.description, transaction && transaction.description);
        const typeSrc = pick(prefill && prefill.type, transaction && transaction.type) || 'expense';

        const amountStr = amountSrc !== undefined && amountSrc !== null ? String(amountSrc) : '';
        const dateStr = dateSrc ? (typeof dateSrc === 'string' ? dateSrc.slice(0,10) : new Date(dateSrc).toISOString().slice(0,10)) : new Date().toISOString().split('T')[0];
        setForm({
          description: descSrc || '',
          amount: amountStr,
          date: dateStr,
          type: typeSrc
        });
        // helpful debug log if values are unexpectedly empty
        // eslint-disable-next-line no-console
        console.log('TransactionModal: populated form', { amount: amountStr, date: dateStr, transaction, prefill });
      } catch (e) {
        console.warn('TransactionModal: failed to populate form', e && e.message ? e.message : e);
      }
    }
    // If modal closed, reset form to defaults
    if (!open) {
      setForm({ description: '', amount: '', date: new Date().toISOString().slice(0,10), type: 'expense' });
    }
  }, [transaction, prefill, open]);

  if (!open) return null;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (transaction && transaction.id) {
        await apiClient.put(`/transactions/${transaction.id}`, form);
      } else {
        // create new transaction
        await apiClient.post('/transactions', form);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Lỗi lưu giao dịch:', err);
      // show server-provided message when available
      const serverMsg = err.response && (err.response.data && (err.response.data.message || err.response.data.details))
        ? (err.response.data.message || JSON.stringify(err.response.data.details))
        : (err.message || 'Lưu giao dịch thất bại');
      toast.push(serverMsg, 'error');
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
