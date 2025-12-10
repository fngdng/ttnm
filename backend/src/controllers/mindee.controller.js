const fs = require('fs');
const os = require('os');
const path = require('path');
const mindee = require('mindee');
const db = require('../models');

// Log masked presence of env vars for debugging (won't print full key)
const _mask = (s) => (s && s.length > 8) ? `${s.slice(0,6)}...${s.slice(-4)}` : (s || '');
console.log('Mindee keys:', { MINDEE_API_KEY: _mask(process.env.MINDEE_API_KEY), MINDEE_MODEL_ID: process.env.MINDEE_MODEL_ID ? process.env.MINDEE_MODEL_ID : '(none)' });

exports.scan = async (req, res) => {
  let tmpPath = null;
  try {
    if (!req.file) return res.status(400).send({ message: 'No file uploaded' });

    const apiKey = process.env.MINDEE_API_KEY;
    const modelId = process.env.MINDEE_MODEL_ID || process.env.MINDEE_MODEL;
    if (!apiKey) return res.status(500).send({ message: 'MINDEE_API_KEY not configured on server' });
    if (!modelId) return res.status(500).send({ message: 'MINDEE_MODEL_ID not configured on server' });

    // write buffer to a temp file (PathInput expects a path)
    tmpPath = path.join(os.tmpdir(), `${Date.now()}-${req.file.originalname}`);
    fs.writeFileSync(tmpPath, req.file.buffer);

    // Prefer ClientV2 (newer SDK) when available and a modelId is provided.
    // This matches the ClientV2.enqueueAndGetInference(PathInput, { modelId }) pattern.
    let resp = null;
    if (mindee.ClientV2 && modelId) {
      try {
        console.log('Mindee: attempting ClientV2.enqueueAndGetInference with modelId', modelId);
        const clientV2 = new mindee.ClientV2({ apiKey: apiKey });
        const input = new mindee.PathInput({ inputPath: tmpPath });
        resp = await clientV2.enqueueAndGetInference(input, { modelId });
        console.log('Mindee: ClientV2 response received?', !!resp);
        console.log(resp);
      } catch (e) {
        console.warn('Mindee ClientV2 call failed, will fallback to older SDK parse flow:', e && e.message ? e.message : e);
      }
    }

    // Fallback to older Client/docFromPath.parse API if ClientV2 didn't return a response
    if (!resp) {
      const ClientClass = mindee.Client || mindee.default?.Client || mindee;
      const client = new ClientClass({ apiKey: apiKey });
      const docClient = client.docFromPath(tmpPath);

      try {
        if (mindee.ReceiptResponse) {
          resp = await docClient.parse(mindee.ReceiptResponse, { fullText: false });
        }
      } catch (e) {
        try {
          if (mindee.InvoiceResponse) {
            resp = await docClient.parse(mindee.InvoiceResponse, { fullText: false });
          }
        } catch (e2) {
          if (mindee.CustomResponse) {
            try { resp = await docClient.parse(mindee.CustomResponse, {}); } catch (e3) { /* ignore */ }
          }
        }
      }
    }

    // Extract best-effort fields from the parsed response or raw http response
    let amount = null, date = null, vendor = null, category = null, currency = null;
    try {
      const httpData = resp && resp.httpResponse && resp.httpResponse.data ? resp.httpResponse.data : null;

      // Candidate locations for the prediction object
      const candidates = [
        resp && resp.document && resp.document.prediction,
        resp && resp.inference && resp.inference.prediction,
        resp && resp.inference,
        httpData && httpData.document && httpData.document.inference && httpData.document.inference.prediction,
        httpData && httpData.inference && httpData.inference.prediction,
        httpData && httpData.inference,
        resp
      ];

      const prediction = candidates.find((c) => c && typeof c === 'object');

      // Mindee SDK sometimes returns a Map-like structure at prediction.result.fields
      // normalize that into a plain object we can iterate easily
      let fieldsSource = prediction;
      try {
        if (prediction && prediction.result && prediction.result.fields) {
          const fld = prediction.result.fields;
          const obj = {};
          if (typeof fld.forEach === 'function') {
            // InferenceFields may implement forEach(key, value)
            // Mindee maps often provide (value, key) to forEach, so handle both
            try {
              fld.forEach((v, k) => { obj[k] = v; });
            } catch (e) {
              // fallback: try Map iteration
              try { for (const [k, v] of fld.entries()) obj[k] = v; } catch (e2) { /* ignore */ }
            }
          } else if (fld instanceof Map) {
            for (const [k, v] of fld.entries()) obj[k] = v;
          } else if (typeof fld === 'object') {
            for (const k of Object.keys(fld)) obj[k] = fld[k];
          }
          fieldsSource = obj;
        }
      } catch (e) {
        // If normalization fails, fall back to original prediction
        fieldsSource = prediction;
      }

      function unwrapField(f) {
        if (f == null) return null;
        if (Array.isArray(f)) {
          // use first element
          return unwrapField(f[0]);
        }
        if (typeof f === 'object') {
          if (f.value !== undefined) return f.value;
          if (f.raw !== undefined) return f.raw;
          if (f.content !== undefined) return f.content;
          if (f.text !== undefined) return f.text;
          // try common nested shapes
          if (f.inference && f.inference.prediction) return f.inference.prediction;
          // fallback stringify
          return f;
        }
        return f;
      }

      function normalizeNumber(x) {
        if (x == null) return null;
        if (typeof x === 'number') return x;
        if (typeof x === 'string') {
          const cleaned = x.replace(/[,\s]/g, '').replace(/[^0-9.\-]/g, '');
          const n = parseFloat(cleaned);
          return Number.isFinite(n) ? n : null;
        }
        return null;
      }

      if (prediction && typeof prediction === 'object') {
        // iterate keys and try to map (use normalized fieldsSource)
        Object.keys(fieldsSource).forEach((k) => {
          const key = k.toLowerCase();
          const rawVal = fieldsSource[k];
          const val = unwrapField(rawVal);

          if (!amount && /(^|_|\b)(total|amount|grand_total|invoice_total|total_amount)(\b|_)/.test(key)) {
            amount = normalizeNumber(val);
          }
          if (!date && /date|invoice_date|issued_date|bill_date/.test(key)) {
            date = typeof val === 'string' ? val : (val && val.toString ? val.toString() : val);
          }
          if (!vendor && /supplier_name|supplier|vendor|merchant|seller|payee/.test(key)) {
            vendor = typeof val === 'string' ? val : (val && val.toString ? val.toString() : val);
          }
          if (!category && /purchase_category|purchase_subcategory|document_type|category|sub_category/.test(key)) {
            category = typeof val === 'string' ? val : (val && val.toString ? val.toString() : val);
          }
          if (!currency && /currency|locale|money/.test(key)) {
            currency = typeof val === 'string' ? val : (val && val.toString ? val.toString() : val);
          }
        });

        // Additional fallbacks for some response shapes
        // Additional fallbacks for some response shapes (assign, don't compare)
        if (!amount && prediction && prediction.total_amount) amount = normalizeNumber(unwrapField(prediction.total_amount.value || prediction.total_amount));
        if (!date && prediction && prediction.date) date = unwrapField(prediction.date.value || prediction.date);
        if (!vendor && prediction && prediction.supplier_name) vendor = unwrapField(prediction.supplier_name.value || prediction.supplier_name);
        if (!category && prediction && prediction.purchase_category) category = unwrapField(prediction.purchase_category.value || prediction.purchase_category);
        if (!currency && prediction && prediction.locale && prediction.locale.currency) currency = unwrapField(prediction.locale.currency.value || prediction.locale.currency);
      }

      // Normalize date: try to create ISO string if possible
      let dateISO = null;
      if (date) {
        const d = new Date(date);
        if (!isNaN(d.getTime())) dateISO = d.toISOString();
        else dateISO = date; // leave as-is if parsing fails
      }

      const parsedResult = { amount, date: dateISO || date, vendor, category, currency };
      console.log(prediction.result.fields);
      console.log('Parsed result:', parsedResult);
      console.log(amount);
      // Auto-insert transaction when user is authenticated and we have at least amount and date
      try {
        if (req.userId && parsedResult.amount && parsedResult.date) {
          // determine transaction type (default to 'expense')
          const txType = (/expense/i.test(String(category)) || /expense_receipt|receipt|bill/.test(String(httpData && httpData.document && httpData.document.inference && httpData.document.inference.prediction ? (httpData.document.inference.prediction.document_type || '') : ''))) ? 'expense' : 'expense';

          // try to find a matching category for the user by name (case-insensitive)
          let matchedCategoryId = null;
          try {
            const catName = parsedResult.category || parsedResult.purchase_category || parsedResult.document_type || parsedResult.vendor || null;
            if (catName) {
              try {
                const cat = await db.Category.findOne({
                  where: {
                    [db.Sequelize.Op.and]: [
                      db.Sequelize.where(db.Sequelize.fn('lower', db.Sequelize.col('name')), catName.toLowerCase()),
                      { userId: req.userId }
                    ]
                  }
                });
                if (cat) matchedCategoryId = cat.id;
              } catch (e) {
                // fallback: try simple name match
                const cat2 = await db.Category.findOne({ where: { userId: req.userId, name: catName } });
                if (cat2) matchedCategoryId = cat2.id;
              }
            }
          } catch (e) {
            // ignore category lookup errors
            matchedCategoryId = null;
          }

          // create transaction
          try {
            const newTx = await db.Transaction.create({
              description: parsedResult.vendor || parsedResult.category || 'Scanned transaction',
              amount: parsedResult.amount,
              date: parsedResult.date,
              type: txType,
              categoryId: matchedCategoryId,
              userId: req.userId
            });
            // emit socket event so Dashboard updates in real-time
            try {
              if (req.io && typeof req.io.to === 'function') {
                req.io.to(`user_${req.userId}`).emit('transaction_updated', {
                  message: 'Scanned transaction saved!',
                  userId: req.userId
                });
              }
            } catch (e) {
              console.warn('Socket emit failed (mindee auto-save):', e && e.message ? e.message : e);
            }
            return res.send({ parsed: parsedResult, raw: httpData || resp, saved: true, transaction: newTx });
          } catch (e) {
            console.error('Failed to save transaction:', e && e.message ? e.message : e);
            // fall through and return parsed without saved transaction
          }
        }
      } catch (e) {
        // ignore errors during auto-save
        console.warn('Auto-save check error:', e && e.message ? e.message : e);
      }

      return res.send({ parsed: parsedResult, raw: httpData || resp });
    } catch (e) {
      // if parsing failed, still return raw resp
      console.error('Parsing response failed:', e && e.message ? e.message : e);
      return res.send({ parsed: { amount, date, vendor, category, currency }, raw: resp });
    }
  } catch (err) {
    console.error('Mindee scan error', err && err.message ? err.message : err);
    const details = err && err.response ? err.response.data : err.message || String(err);
    res.status(500).send({ message: 'Scan failed', details });
  } finally {
    // clean up tmp file
    try { if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
  }
};

// Debug endpoint: returns a human-readable inference summary plus parsed fields and raw data.
exports.debug = async (req, res) => {
  let tmpPath = null;
  try {
    if (!req.file) return res.status(400).send({ message: 'No file uploaded' });

    const apiKey = process.env.MINDEE_API_KEY;
    const modelId = process.env.MINDEE_MODEL_ID || process.env.MINDEE_MODEL;
    if (!apiKey) return res.status(500).send({ message: 'MINDEE_API_KEY not configured on server' });

    tmpPath = path.join(os.tmpdir(), `${Date.now()}-${req.file.originalname}`);
    fs.writeFileSync(tmpPath, req.file.buffer);

    // Try ClientV2 if available (prefer explicit modelId), otherwise use the docFromPath.parse flow
    const ClientClassDebug = mindee.ClientV2 || mindee.Client || mindee.default?.Client || mindee;
    let resp = null;
    if (mindee.ClientV2 && modelId) {
      try {
        console.log('Mindee debug: using ClientV2.enqueueAndGetInference with modelId', modelId);
        const clientV2 = new mindee.ClientV2({ apiKey: apiKey });
        const input = new mindee.PathInput({ inputPath: tmpPath });
        resp = await clientV2.enqueueAndGetInference(input, { modelId });
      } catch (e) {
        console.warn('Mindee debug ClientV2 failed:', e && e.message ? e.message : e);
      }
    }

    if (!resp) {
      try {
        const client = new ClientClassDebug({ apiKey: apiKey });
        if (client.docFromPath) {
          const docClient = client.docFromPath(tmpPath);
          try { resp = await docClient.parse(); } catch (err) {
            const tries = [mindee.ReceiptResponse, mindee.InvoiceResponse, mindee.CustomResponse, mindee.Document];
            for (const t of tries) {
              if (!t) continue;
              try { resp = await docClient.parse(t, { fullText: false }); break; } catch (e) { /* ignore */ }
            }
          }
        }
      } catch (e) {
        console.warn('Mindee debug fallback parse failed:', e && e.message ? e.message : e);
      }
    }

    const httpData = resp && resp.httpResponse && resp.httpResponse.data ? resp.httpResponse.data : resp;

    // Build a readable inference summary if available
    let summaryText = null;
    if (resp && resp.inference && typeof resp.inference.toString === 'function') {
      try { summaryText = resp.inference.toString(); } catch (e) { summaryText = null; }
    }
    if (!summaryText && httpData && httpData.document && httpData.document.inference) {
      try {
        const inf = httpData.document.inference;
        let lines = [];
        lines.push('Inference');
        lines.push('#########');
        if (inf.model) lines.push('\nModel\n=====' + '\n:ID: ' + (inf.model.id || inf.model));
        if (httpData.file) lines.push('\nFile\n====\n:Name: ' + (httpData.file.name || req.file.originalname));
        if (inf.active_options) {
          lines.push('\nActive Options\n==============');
          for (const k of Object.keys(inf.active_options)) lines.push(':' + k + ': ' + inf.active_options[k]);
        }
        if (inf.prediction) {
          lines.push('\nFields\n======');
          const p = inf.prediction;
          for (const k of Object.keys(p)) {
            const v = p[k];
            const vv = (v && (v.value || v.raw || v.text || v.content)) ? (v.value || v.raw || v.text || v.content) : v;
            lines.push(':' + k + ': ' + (typeof vv === 'object' ? JSON.stringify(vv) : vv));
          }
        }
        summaryText = lines.join('\n');
      } catch (e) {
        summaryText = null;
      }
    }

    // Reuse scan parsing logic to extract fields
    let parsed = { amount: null, date: null, vendor: null, category: null, currency: null };
    try {
      // reuse candidates logic from scan
      const candidates = [
        resp && resp.document && resp.document.prediction,
        resp && resp.inference && resp.inference.prediction,
        resp && resp.inference,
        httpData && httpData.document && httpData.document.inference && httpData.document.inference.prediction,
        httpData && httpData.inference && httpData.inference.prediction,
        httpData && httpData.inference,
        resp
      ];
      const prediction = candidates.find((c) => c && typeof c === 'object');
      const unwrap = (f) => { if (f == null) return null; if (Array.isArray(f)) return unwrap(f[0]); if (typeof f === 'object') return f.value ?? f.raw ?? f.text ?? JSON.stringify(f); return f; };
      const normNum = (x) => { if (x == null) return null; if (typeof x === 'number') return x; if (typeof x === 'string') { const c = x.replace(/[,\s]/g, '').replace(/[^0-9.\-]/g,''); const n = parseFloat(c); return Number.isFinite(n) ? n : null; } return null; };
      if (prediction) {
        Object.keys(prediction).forEach((k) => {
          const key = k.toLowerCase();
          const val = unwrap(prediction[k]);
          if (!parsed.amount && /total|amount/.test(key)) parsed.amount = normNum(val);
          if (!parsed.date && /date/.test(key)) parsed.date = val;
          if (!parsed.vendor && /supplier|vendor|merchant|seller/.test(key)) parsed.vendor = val;
          if (!parsed.category && /purchase_category|document_type|category/.test(key)) parsed.category = val;
          if (!parsed.currency && /currency|locale/.test(key)) parsed.currency = val;
        });
      }

    } catch (e) { /* ignore */ }

    return res.send({ summary: summaryText, parsed, raw: httpData || resp });
  } catch (err) {
    console.error('Mindee debug error', err && err.message ? err.message : err);
    const details = err && err.response ? err.response.data : err.message || String(err);
    res.status(500).send({ message: 'Debug scan failed', details });
  } finally {
    try { if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
  }
};
