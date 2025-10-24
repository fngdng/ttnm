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
      console.error('Error fetching categories:', err);
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
    } catch (err) { console.error(err); toast.push('Failed to add category', 'error'); }
  };

  const startEdit = (cat) => { setEditingId(cat.id); setEditingName(cat.name); setType(cat.type); };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.put(`/categories/${editingId}`, { name: editingName, type });
      setEditingId(null); setEditingName('');
      fetchCategories();
      if (onChange) onChange();
    } catch (err) { console.error(err); toast.push('Failed to update', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await apiClient.delete(`/categories/${id}`);
      fetchCategories();
      if (onChange) onChange();
    } catch (err) { console.error(err); toast.push('Failed to delete', 'error'); }
  };

  return (
    <div className="cm-categories">
      <h4>Categories</h4>
      <form onSubmit={editingId ? handleUpdate : handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={editingId ? editingName : name}
          onChange={(e) => editingId ? setEditingName(e.target.value) : setName(e.target.value)}
          placeholder="Category name"
          required
          style={{ padding: 8 }}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: 8 }}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <button type="submit" style={{ padding: '8px 12px' }}>{editingId ? 'Update' : 'Add'}</button>
        {editingId && <button type="button" onClick={() => setEditingId(null)}>Cancel</button>}
      </form>

      {loading && <div>Loading categories...</div>}
      {!loading && categories.length === 0 && <div>No categories yet.</div>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {categories.map(cat => (
          <li key={cat.id} style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{cat.name}</strong>
              <div style={{ fontSize: '0.85em', color: '#666' }}>{cat.type}</div>
            </div>
            <div>
              <button onClick={() => startEdit(cat)} style={{ marginRight: 8 }}>Edit</button>
              <button onClick={() => handleDelete(cat.id)} style={{ color: 'red' }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
