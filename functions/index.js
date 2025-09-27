// Firebase Functions v2 (Node 18+)
// Deploy: firebase deploy --only functions
import { onRequest } from "firebase-functions/v2/https";

// CORS helper
function allowCors(res){
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
}

const BASE = 'https://portal.packzy.com/api/v1'; // Official v1 base

export const steadfastVerify = onRequest({ cors: true }, async (req, res) => {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ message:'Method not allowed' });

  const { apiKey, secretKey } = req.body || {};
  if (!apiKey || !secretKey){
    return res.status(400).json({ message:'apiKey and secretKey are required' });
  }

  try{
    const r = await fetch(`${BASE}/get_balance`, {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey
      }
    });
    const text = await r.text();
    let json; try{ json = JSON.parse(text); }catch(_){ json = { raw: text }; }
    if (!r.ok) throw new Error(json?.message || `HTTP ${r.status}`);
    // Typical: { status:200, current_balance: 0 }
    return res.status(200).json(json);
  }catch(err){
    return res.status(502).json({ message: String(err.message || err) });
  }
});

export const steadfastPlaceOrder = onRequest({ cors: true }, async (req, res) => {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ message:'Method not allowed' });

  const { apiKey, secretKey, order } = req.body || {};
  if (!apiKey || !secretKey || !order){
    return res.status(400).json({ message:'apiKey, secretKey and order are required' });
  }

  try{
    const r = await fetch(`${BASE}/create_order`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Api-Key': apiKey,
        'Secret-Key': secretKey
      },
      body: JSON.stringify(order)
    });
    const text = await r.text();
    let json; try{ json = JSON.parse(text); }catch(_){ json = { raw: text }; }
    if (!r.ok) throw new Error(json?.message || `HTTP ${r.status}`);
    return res.status(200).json(json);
  }catch(err){
    return res.status(502).json({ message: String(err.message || err) });
  }
});
