// functions/index.js
// Deploy: firebase deploy --only functions
import { onRequest } from "firebase-functions/v2/https";
import fetch from "node-fetch";

// CORS
function allowCors(res){
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function getHeaders(apiKey, secretKey){
  return {
    'Content-Type':'application/json',
    'Api-Key': apiKey,
    'Secret-Key': secretKey
  };
}

export const steadfastVerify = onRequest({ cors: true }, async (req, res) => {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')     return res.status(405).json({ message:'Method not allowed' });

  try{
    const { apiKey, secretKey } = req.body || {};
    if (!apiKey || !secretKey) return res.status(400).json({ message:'apiKey & secretKey required' });

    // Most commonly exposed endpoint for a quick, harmless verification is `get_balance`
    // on Packzy/Steadfast APIs with Api-Key / Secret-Key headers.
    // Try get_balance first; if that fails, try merchant/profile-like fallbacks if they ever exist.
    const base = 'https://portal.steadfast.com.bd/api/v1';
    const headers = getHeaders(apiKey, secretKey);

    // Primary verification – balance endpoint
    const r = await fetch(`${base}/get_balance`, { method:'POST', headers, body: JSON.stringify({}) });
    const t = await r.text();
    let j; try{ j = JSON.parse(t); }catch(_){ j = { raw:t }; }
    if (!r.ok) throw new Error(j?.message || j?.error || `HTTP ${r.status}`);

    // Normalized profile-ish data (the response often only has balance)
    const profile = {
      balance: j?.balance ?? j?.data?.balance ?? null
    };
    return res.status(200).json({ ok:true, profile });
  }catch(err){
    return res.status(200).json({ ok:false, message: String(err.message || err) });
  }
});

export const steadfastPlaceOrder = onRequest({ cors: true }, async (req, res) => {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')     return res.status(405).json({ message:'Method not allowed' });

  try{
    const { apiKey, secretKey, order } = req.body || {};
    if (!apiKey || !secretKey || !order){
      return res.status(400).json({ message:'apiKey, secretKey and order are required' });
    }

    const base = 'https://portal.steadfast.com.bd/api/v1';
    const headers = getHeaders(apiKey, secretKey);

    async function hit(path){
      const r = await fetch(base + path, { method:'POST', headers, body: JSON.stringify(order) });
      const t = await r.text();
      let json; try{ json = JSON.parse(t); }catch(_){ json = { raw:t }; }
      if (!r.ok) throw new Error(json?.message || json?.error || `HTTP ${r.status}`);
      return json;
    }

    // Try new → old
    let out;
    try { out = await hit('/place-order'); }
    catch(_e){ out = await hit('/create_order'); }

    return res.status(200).json({ ok:true, result: out });
  }catch(err){
    return res.status(200).json({ ok:false, message: String(err.message || err) });
  }
});
