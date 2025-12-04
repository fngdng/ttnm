# Mindee integration (backend proxy)

This project includes a server-side proxy endpoint for scanning receipts using Mindee.

Required environment variables (add to `backend/.env`):

- `MINDEE_API_KEY` - Your Mindee API key (keep this secret; do not commit it).
- Optional: `MINDEE_API_URL` - If you use a specific Mindee product endpoint. Default used by the proxy:
  `https://api.mindee.net/v1/products/mindee/invoices/v1/predict`

How it works

- Frontend uploads an image to `POST /api/mindee/scan` (multipart/form-data, field name `file`).
- Backend (`mindee.controller`) forwards the file to Mindee and returns a `parsed` object plus `raw` response for debugging.

Quick test (backend):

1. Create or update `.env` in `backend` with your API key. Example:

```
MINDEE_API_KEY=your_real_api_key_here
MINDEE_API_URL=https://api.mindee.net/v1/products/your_product/predict
```

2. Install dependencies and start server from the `backend` folder:

```powershell
cd c:\Users\Admin\Documents\GitHub\ttnm\backend
npm install
npm run dev
```

3. Use the frontend UI to upload a receipt, or test with the included `test_mindee_post.js` script:

```powershell
# from backend folder
node test_mindee_post.js
```

If the scan fails, check backend terminal logs — the controller returns detailed `message` / `details` on error.

Security note

- Never expose `MINDEE_API_KEY` in frontend code or public repos. Keep it server-side only.
