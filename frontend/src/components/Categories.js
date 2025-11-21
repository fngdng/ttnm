import React, { useEffect, useState } from 'react';
import apiClient from '../services/api';
import { useToast } from './ToastProvider';

export default function Categories({ onChange }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const toast = useToast();

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/categories', { name, type });
      setName(''); setType('expense');
      fetchCategories();
      if (onChange) onChange();
    } catch (err) { console.error(err); toast.push('Thêm danh mục thất bại', 'error'); }
  };

  const startEdit = (cat) => { setEditingId(cat.id); setEditingName(cat.name); setType(cat.type); };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.put(`/categories/${editingId}`, { name: editingName, type });
      setEditingId(null); setEditingName('');
      fetchCategories();
      if (onChange) onChange();
    } catch (err) { console.error(err); toast.push('Cập nhật danh mục thất bại', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa danh mục này?')) return;
    try {
      await apiClient.delete(`/categories/${id}`);
      fetchCategories();
      if (onChange) onChange();
    } catch (err) { console.error(err); toast.push('Xóa danh mục thất bại', 'error'); }
  };

  return (
    <div className="cm-categories">
      <h4>Danh mục</h4>
      <form onSubmit={editingId ? handleUpdate : handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={editingId ? editingName : name}
          onChange={(e) => editingId ? setEditingName(e.target.value) : setName(e.target.value)}
          placeholder="Tên danh mục"
          required
          style={{ padding: 8 }}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: 8 }}>
          <option value="expense">Chi tiêu</option>
          <option value="income">Thu nhập</option>
        </select>
        <button type="submit" style={{ padding: '8px 12px' }}>{editingId ? 'Cập nhật' : 'Thêm'}</button>
        {editingId && <button type="button" onClick={() => setEditingId(null)}>Hủy</button>}
      </form>

      {loading && <div>Đang tải danh mục...</div>}
      {!loading && categories.length === 0 && <div>Chưa có danh mục.</div>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {categories.map(cat => (
          <li key={cat.id} style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{cat.name}</strong>
              <div style={{ fontSize: '0.85em', color: '#666' }}>
                {cat.type === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
              </div>
            </div>
            <div>
              <button onClick={() => startEdit(cat)} style={{ marginRight: 8 }}>Sửa</button>
              <button onClick={() => handleDelete(cat.id)} style={{ color: 'red' }}>Xóa</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
