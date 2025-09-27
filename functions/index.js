// functions/index.js
// Firebase Functions v2 (Node 18+). Deploy with: firebase deploy --only functions
// Uses official Steadfast/Packzy API v1 endpoints.
// Docs: https://portal.packzy.com/api/v1  (public doc mirrored here: Google Doc)

import { onRequest } from "firebase-functions/v2/https";
import fetch from "node-fetch";

// CORS helper
function allowCors(res){
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

const BASE = 'https://portal.packzy.com/api/v1';

// POST /api/steadfastVerify  { apiKey, secretKey }
// -> calls GET /get_balance to validate keys
export const steadfastVerify = onRequest({ cors: true }, async (req, res) => {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ message:'Method not allowed' });

  const { apiKey, secretKey } = req.body || {};
  if (!apiKey || !secretKey) {
    return res.status(400).json({ message:'apiKey and secretKey are required' });
  }
  try {
    const r = await fetch(`${BASE}/get_balance`, {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json'
      }
    });
    const t = await r.text();
    let json; try { json = JSON.parse(t); } catch { json = { raw: t }; }
    if (!r.ok) throw new Error(json?.message || json?.error || `HTTP ${r.status}`);
    // returns { status:200, current_balance: ... }
    return res.status(200).json({ ok:true, balance: json.current_balance ?? null });
  } catch (err) {
    return res.status(502).json({ ok:false, message: String(err.message || err) });
  }
});

// POST /api/steadfastPlaceOrder  { apiKey, secretKey, order }
// -> calls POST /create_order
export const steadfastPlaceOrder = onRequest({ cors: true }, async (req, res) => {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ message:'Method not allowed' });

  const { apiKey, secretKey, order } = req.body || {};
  if (!apiKey || !secretKey || !order) {
    return res.status(400).json({ message:'apiKey, secretKey and order are required' });
  }

  try {
    const r = await fetch(`${BASE}/create_order`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(order)
    });
    const t = await r.text();
    let json; try { json = JSON.parse(t); } catch { json = { raw: t }; }
    if (!r.ok) throw new Error(json?.message || json?.error || `HTTP ${r.status}`);
    return res.status(200).json(json);
  } catch (err) {
    return res.status(502).json({ message: String(err.message || err) });
  }
});
