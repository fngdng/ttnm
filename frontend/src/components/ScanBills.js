import React, { useEffect, useState } from 'react';
import apiClient from '../services/api';
import './ScanBills.css';
import TransactionModal from './TransactionModal';

export default function ScanBills({ onSaved }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState({ amount: '', date: '', vendor: '' });
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [type, setType] = useState('expense');
  const [description, setDescription] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTx, setModalTx] = useState(null);
  const [prefillState, setPrefillState] = useState({ description: '', amount: '', date: '' });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await apiClient.get('/categories');
      setCategories(res.data || []);
      const firstExpense = (res.data || []).find(c => c.type === 'expense');
      if (firstExpense) setCategoryId(firstExpense.id);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setParsed({ amount: '', date: '', vendor: '' });
  };

  const handleUpload = async () => {
    if (!file) return alert('Please choose a file first.');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);

      // Call backend proxy which forwards to Mindee (keeps API key secret)
      const res = await apiClient.post('/mindee/scan', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Defensive parsing: support a few possible shapes returned from backend
      const data = res.data || {};
      // raw object log
      console.log('Mindee scan response:', data);
      // pretty-print JSON string for easy copy/paste
      try { console.log('Mindee scan response (pretty):\n' + JSON.stringify(data, null, 2)); } catch (e) { /* ignore stringify errors */ }
      // Common shape: { parsed: { amount, date, vendor } }
      const getFirst = (obj, keys) => {
        if (!obj) return undefined;
        for (const k of keys) {
          if (obj[k] !== undefined && obj[k] !== null) return obj[k];
        }
        return undefined;
      };

      let amount = getFirst(data.parsed, ['amount', 'total_amount', 'total', 'value']) ?? getFirst(data, ['amount', 'total_amount', 'total', 'value']) ?? '';
      let date = getFirst(data.parsed, ['date', 'invoice_date']) ?? getFirst(data, ['date', 'invoice_date']) ?? '';
      let vendor = getFirst(data.parsed, ['vendor', 'supplier_name', 'supplier']) ?? getFirst(data, ['vendor', 'supplier_name', 'supplier']) ?? '';

      // Helper: deep search object for keys that look like amount/total and return first numeric-like value
      const deepFindAmount = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        const stack = [obj];
        while (stack.length) {
          const cur = stack.shift();
          if (!cur || typeof cur !== 'object') continue;
          for (const k of Object.keys(cur)) {
            const v = cur[k];
            const key = String(k).toLowerCase();
            if (typeof v === 'string') {
              // look for currency marker or numeric patterns
              if (/(total|amount|value|sum|grand)/i.test(key) || /vnd|đ|d|usd|eur/i.test(v) || /[0-9][.,\s][0-9]/.test(v)) {
                return v;
              }
            }
            if (typeof v === 'number') {
              if (/(total|amount|value|sum|grand)/i.test(key)) return String(v);
            }
            if (typeof v === 'object') stack.push(v);
          }
        }
        return null;
      };

      // If amount still empty, try deep find
      if (!amount) {
        const found = deepFindAmount(data.parsed) || deepFindAmount(data) || null;
        if (found) {
          // strip currency words and keep numbers, dots and commas
          // eslint-disable-next-line no-useless-escape
          const s = String(found).replace(/[^0-9.,\/-]/g, '').trim();
          if (s) amount = s;
        }
      }

      // Normalize amount: remove grouping separators and trailing slashes, convert comma decimals to dot when appropriate
      const normalizeAmount = (raw) => {
        if (!raw && raw !== 0) return '';
        let s = String(raw).trim();
        // common separators: spaces, commas; remove non-digit except '.' and ',' and '-'
        s = s.replace(/[^0-9.,-]/g, '');
        // If contains both '.' and ',', assume '.' is thousands and comma is decimal in some locales, or vice versa.
        if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
          // decide: if last separator is comma, treat comma as decimal
          const lastComma = s.lastIndexOf(',');
          const lastDot = s.lastIndexOf('.');
          if (lastComma > lastDot) {
            s = s.replace(/\./g, '').replace(/,/g, '.');
          } else {
            s = s.replace(/,/g, '');
          }
        } else if (s.indexOf(',') > -1) {
          // if comma present and there are 3 digits after last comma, it's probably thousands separator
          const parts = s.split(',');
          const last = parts[parts.length-1];
          if (last.length === 3) {
            s = s.replace(/,/g, '');
          } else {
            s = s.replace(/,/g, '.');
          }
        }
        // remove leading/trailing non-numeric dots
        s = s.replace(/^\.+|\.+$/g, '');
        return s;
      };

      amount = normalizeAmount(amount);

      // Some APIs return nested inference arrays; try to discover amount and date heuristically
      if ((!amount || !date) && data.inference) {
        try {
          const text = JSON.stringify(data.inference).toLowerCase();
          const amountMatch = text.match(/\b\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?\b/);
          if (!amount && amountMatch) amount = amountMatch[0].replace(/[,\s]/g, '');
        } catch (e) { /* ignore */ }
      }

      // If still missing, try extracting from a human-readable summary string returned by debug flow
      if ((!amount || !date || !vendor) && (data.summary || (data.parsed && data.parsed.summary))) {
        const summary = (data.summary || (data.parsed && data.parsed.summary) || '').toString();
        try {
          if (!amount) {
            // eslint-disable-next-line no-useless-escape
            const a = summary.match(/:?\s*(?:total_amount|total|amount)\s*:\s*([0-9.,]+)/i) || summary.match(/([0-9]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2}))/);
            if (a && a[1]) amount = a[1].replace(/[,\s]/g, '');
          }
          if (!date) {
            // eslint-disable-next-line no-useless-escape
            const d = summary.match(/:?\s*(?:date|invoice_date)\s*:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i) || summary.match(/:?\s*(?:date|invoice_date)\s*:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
            if (d && d[1]) {
              // convert dd/mm/yyyy to yyyy-mm-dd if needed
              const v = d[1];
              if (/\d{2}\/\d{2}\/\d{4}/.test(v)) {
                const parts = v.split('/');
                let mm = parts[0], dd = parts[1], yyyy = parts[2];
                const asNum1 = parseInt(mm,10);
                const asNum2 = parseInt(dd,10);
                if (asNum1>12 && asNum2<=12) { mm = String(asNum2).padStart(2,'0'); dd = String(asNum1).padStart(2,'0'); }
                date = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
              } else {
                date = d[1];
              }
            }
          }
          if (!vendor) {
            const vmatch = summary.match(/:?\s*(?:supplier_name|supplier|vendor)\s*:\s*(.+)/i);
            if (vmatch && vmatch[1]) {
              // take first line until newline
              vendor = vmatch[1].split('\n')[0].trim();
            }
          }
        } catch (e) { /* ignore */ }
      }

      // Normalize date if in dd/mm/yyyy -> yyyy-mm-dd
      // eslint-disable-next-line no-unused-vars
      const normalizeDate = (d) => {
        if (!d) return '';
        const s = String(d).trim();
        // ISO-like already
        // eslint-disable-next-line no-useless-escape
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
        // dd/mm/yyyy or mm/dd/yyyy - try dd/mm/yyyy first
        // eslint-disable-next-line no-useless-escape
        const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
        if (m) {
          const [ , p1, p2, y ] = m;
          // assume p1=dd, p2=mm except when p1>12
          let dd = p1, mm = p2;
          if (parseInt(p1,10) > 12 && parseInt(p2,10) <= 12) { dd = p2; mm = p1; }
          return `${y}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
        }
        // fallback: try Date parse
        const dt = new Date(s);
        if (!isNaN(dt.getTime())) return dt.toISOString().slice(0,10);
        return '';
      };

      const parsedObj = { amount: amount ? String(amount) : '', date: date ? normalizeDate(date) : '', vendor: vendor ? String(vendor) : '' };
      setParsed(parsedObj);
      setDescription(vendor || '');
      setType('expense');

      // set explicit prefill state so TransactionModal gets values immediately
      const prefill = { description: parsedObj.vendor || parsedObj.description || 'Scanned transaction', amount: parsedObj.amount || '', date: parsedObj.date || new Date().toISOString().slice(0,10) };
      setPrefillState(prefill);

      // Open review modal with parsed values so user can edit/confirm before saving
      // If backend already saved a transaction, prefer that returned object so amount/id are preserved
      const txForModal = data && data.saved && data.transaction ? {
        id: data.transaction.id,
        description: data.transaction.description,
        amount: String(data.transaction.amount),
        date: data.transaction.date,
        type: data.transaction.type || 'expense'
      } : {
        // no id => TransactionModal will POST to create
        description: parsedObj.vendor || parsedObj.category || 'Scanned transaction',
        amount: parsedObj.amount || '',
        date: parsedObj.date || new Date().toISOString().slice(0,10),
        type: 'expense'
      };
        setModalTx(txForModal);
        // debug log detailed scan results for easier mapping/troubleshooting
        // eslint-disable-next-line no-console
        console.log('Scan result details:', { data, parsedObj, prefill, txForModal });
        try { console.log('Scan result details (pretty):\n' + JSON.stringify({ data, parsedObj, prefill, txForModal }, null, 2)); } catch (e) { /* ignore */ }
        // pass parsed values as prefill so modal shows amount/date even if saved transaction missing fields
        setModalOpen(true);
    } catch (err) {
      const serverMsg = err.response && (err.response.data && (err.response.data.message || err.response.data.details))
        ? (err.response.data.message || JSON.stringify(err.response.data.details))
        : null;
      console.error('Scan failed', err.response ? err.response.data : err);
      alert(`Scan failed: ${serverMsg || err.message || 'See console for details.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Deprecated: saving now handled by TransactionModal. Keep for fallback.
    if (!parsed.amount || !parsed.date) {
      if (!window.confirm('Amount or date missing. Save anyway?')) return;
    }

    try {
      const payload = {
        description: description || parsed.vendor || '',
        amount: parsed.amount || 0,
        date: parsed.date || new Date().toISOString().slice(0, 10),
        type: type,
        categoryId: categoryId || null
      };

      const res = await apiClient.post('/transactions', payload);
      if (onSaved) onSaved(res.data);
      // reset
      setFile(null); setPreview(null); setParsed({ amount: '', date: '', vendor: '' });
      alert('Transaction saved');
    } catch (err) {
      console.error('Save failed', err);
      alert('Failed to save transaction.');
    }
  };

  return (
    <>
    <div className="scan-bills">
      <div className="scan-bills__header">
        <h3>Quét hóa đơn / biên lai </h3>
        <p className="scan-bills__hint">Tải ảnh hóa đơn để tự động trích xuất thông tin</p>
      </div>

      <div className="scan-bills__content">
        <div className="scan-bills__upload-section">
          <div className="scan-bills__file-area">
            {!preview ? (
              <label className="scan-bills__file-label">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="scan-bills__file-input"
                />
                <div className="scan-bills__file-placeholder">
                  <div className="scan-bills__file-icon">📷</div>
                  <p className="scan-bills__file-text">
                    <strong>Click để chọn ảnh</strong> hoặc kéo thả vào đây
                  </p>
                  <p className="scan-bills__file-hint">Hỗ trợ: JPG, PNG, PDF</p>
                </div>
              </label>
            ) : (
              <div className="scan-bills__preview-wrapper">
                <img src={preview} alt="Preview" className="scan-bills__preview" />
                <button 
                  className="scan-bills__preview-close"
                  onClick={() => { setFile(null); setPreview(null); setParsed({ amount: '', date: '', vendor: '' }); }}
                  title="Xóa ảnh"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="scan-bills__actions">
            <button 
              className="scan-bills__btn scan-bills__btn--primary"
              onClick={handleUpload} 
              disabled={loading || !file}
            >
              {loading ? (
                <>
                  <span className="scan-bills__spinner"></span>
                  Đang quét...
                </>
              ) : (
                <>
                  🔍 Quét với Mindee
                </>
              )}
            </button>
            {file && (
              <button 
                className="scan-bills__btn scan-bills__btn--secondary"
                onClick={() => { setFile(null); setPreview(null); setParsed({ amount: '', date: '', vendor: '' }); }}
              >
                Xóa
              </button>
            )}
          </div>
        </div>

        {(parsed.amount || parsed.date || parsed.vendor) && (
          <div className="scan-bills__parsed-section">
            <div className="scan-bills__parsed-header">
              <h4>Thông tin đã trích xuất</h4>
              <span className="scan-bills__parsed-badge">✓</span>
            </div>
            <div className="scan-bills__parsed-content">
              <div className="scan-bills__parsed-item">
                <label className="scan-bills__label">
                  <span className="scan-bills__label-text">Số tiền</span>
                  <input 
                    type="text"
                    value={parsed.amount} 
                    onChange={(e) => setParsed({ ...parsed, amount: e.target.value })} 
                    className="scan-bills__input"
                    placeholder="0"
                  />
                </label>
              </div>
              
              <div className="scan-bills__parsed-item">
                <label className="scan-bills__label">
                  <span className="scan-bills__label-text">Ngày</span>
                  <input 
                    type="date" 
                    value={parsed.date} 
                    onChange={(e) => setParsed({ ...parsed, date: e.target.value })} 
                    className="scan-bills__input"
                  />
                </label>
              </div>

              <div className="scan-bills__parsed-item">
                <label className="scan-bills__label">
                  <span className="scan-bills__label-text">Nhà cung cấp / Mô tả</span>
                  <input 
                    type="text"
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    className="scan-bills__input"
                    placeholder="Nhập mô tả..."
                  />
                </label>
              </div>

              <div className="scan-bills__parsed-item">
                <label className="scan-bills__label">
                  <span className="scan-bills__label-text">Loại</span>
                  <select 
                    value={type} 
                    onChange={(e) => setType(e.target.value)} 
                    className="scan-bills__select"
                  >
                    <option value="expense">Chi tiêu</option>
                    <option value="income">Thu nhập</option>
                  </select>
                </label>
              </div>

              <div className="scan-bills__parsed-item">
                <label className="scan-bills__label">
                  <span className="scan-bills__label-text">Danh mục</span>
                  <select 
                    value={categoryId || ''} 
                    onChange={(e) => setCategoryId(e.target.value)} 
                    className="scan-bills__select"
                  >
                    <option value="">Chọn danh mục...</option>
                    {categories.filter(c => c.type === type).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    {
      // log the exact prefill and modal transaction we're about to pass
      // eslint-disable-next-line no-console
      console.log('Passing to TransactionModal', { prefillState, modalTx, modalOpen })
    }
    <TransactionModal
      open={modalOpen}
      transaction={modalTx}
      prefill={prefillState}
      onClose={() => { setModalOpen(false); setModalTx(null); }}
      onSaved={() => { setModalOpen(false); setModalTx(null); if (onSaved) onSaved(); setFile(null); setPreview(null); setParsed({ amount: '', date: '', vendor: '' }); }}
    />
    </>
  );
}
