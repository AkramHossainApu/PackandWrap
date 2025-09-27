// ================================
// app.js — App core + Orders support
// - Auth (username == userId)
// - Robust order-message parsing (BN/EN, labeled/unlabeled)
// - Secure (encrypted) storage for Steadfast API keys in Firestore
// - Verify keys via /api/steadfastVerify
// - Place order via /api/steadfastPlaceOrder
// ================================

if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  location.replace('https://' + location.host + location.pathname + location.search + location.hash);
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// --- Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyD35RFbmf7vRPF1o_VbyEZ1K7wqAYeBhzA",
  authDomain: "packandwrap-web.firebaseapp.com",
  projectId: "packandwrap-web",
  storageBucket: "packandwrap-web.firebasestorage.app",
  messagingSenderId: "583470090860",
  appId: "1:583470090860:web:32c2d3b35d262a71fde649"
};
const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);

// ---------- Helpers ----------
export async function sha(input){
  const te = new TextEncoder();
  if (crypto?.subtle?.digest) {
    const buf = await crypto.subtle.digest('SHA-256', te.encode(input));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  // tiny fallback (rare)
  function R(n,x){return(x>>>n)|(x<<(32-n));}
  function toWords(bytes){const w=[];for(let i=0;i<bytes.length;i+=4)w.push((bytes[i]<<24)|(bytes[i+1]<<16)|(bytes[i+2]<<8)|bytes[i+3]);return w;}
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let H0=0x6a09e667,H1=0xbb67ae85,H2=0x3c6ef372,H3=0xa54ff53a,H4=0x510e527f,H5=0x9b05688,H6=0x1f83d9ab,H7=0x5be0cd19;
  const te2 = new TextEncoder();
  const bytes=[...te2.encode(input)];const bitLen=bytes.length*8;bytes.push(0x80);while((bytes.length%64)!==56)bytes.push(0);for(let i=7;i>=0;i--)bytes.push((bitLen>>>(i*8))&0xff);
  for(let i=0;i<bytes.length;i+=64){const c=bytes.slice(i,i+64);const w=new Array(64);const ws=toWords(c);for(let t=0;t<16;t++)w[t]=ws[t];
    for(let t=16;t<64;t++){const s0=R(7,w[t-15])^R(18,w[t-15])^(w[t-15]>>>3);const s1=R(17,w[t-2])^R(19,w[t-2])^(w[t-2]>>>10);w[t]=(w[t-16]+s0+w[t-7]+s1)|0;}
    let a=H0,b=H1,c2=H2,d=H3,e=H4,f=H5,g=H6,h=H7;
    for(let t=0;t<64;t++){const S1=R(6,e)^R(11,e)^R(25,e);const ch=(e&f)^(~e&g);const t1=(h+S1+ch+K[t]+w[t])|0;const S0=R(2,a)^R(13,a)^R(22,a);const maj=(a&b)^(a&c2)^(b&c2);const t2=(S0+maj)|0;h=g;g=f;f=e;e=(d+t1)|0;d=c2;c2=b;b=a;a=(t1+t2)|0;}
    H0=(H0+a)|0;H1=(H1+b)|0;H2=(H2+c2)|0;H3=(H3+d)|0;H4=(H4+e)|0;H5=(H5+f)|0;H6=(H6+g)|0;H7=(H7+h)|0;}
  return [H0,H1,H2,H3,H4,H5,H6,H7].map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}

// Bangla digits → English
export function bnToEnDigits(s=""){
  const map = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };
  return String(s).replace(/[০-৯]/g, ch => map[ch] ?? ch);
}

// Phone normalizer (BD)
export function normalizeBdPhone(raw=""){
  const t = bnToEnDigits(raw).replace(/[^\d+]/g,'');
  let digits = t.replace(/\D/g,'');
  if (digits.startsWith('8801') && digits.length >= 13) digits = digits.slice(digits.length-11);
  if (digits.startsWith('01') && digits.length > 11)    digits = digits.slice(0,11);
  if (digits.length >= 11 && digits.endsWith('01'))     digits = digits.slice(-11);
  if (digits.length === 11 && digits.startsWith('01'))  return digits;
  const m = digits.match(/01\d{9}/);
  return m ? m[0] : t;
}

const sanitizeId = s => (s||'')
  .toLowerCase().trim().replace(/\s+/g,'').replace(/[^a-z0-9._-]/g,'');

// ------------- SIGNUP -------------
export async function addUser(username, password, chosenId){
  const usernameLower = (username||'').trim().toLowerCase();
  const userId = sanitizeId(chosenId);
  if (!usernameLower) throw new Error('Username required');
  if (!userId) throw new Error('User ID required');

  const userRef = doc(db, "users", userId);
  const exists  = (await getDoc(userRef)).exists();
  if (exists) throw new Error("User ID already exists");

  const passHash = await sha(password);
  const now = new Date().toISOString();

  await setDoc(userRef, {
    userId,
    username,
    usernameLower,
    passwordHash: passHash,
    createdAt: now
  });
}

// ------------- LOGIN -------------
export async function loginWithNameOrId(identifier, password){
  const userId = sanitizeId(identifier);
  if(!userId) return { ok:false };
  const snap = await getDoc(doc(db, "users", userId));
  if(!snap.exists()) return { ok:false };
  const data = snap.data();
  const passHash = await sha(password);
  if (data.passwordHash !== passHash) return { ok:false };
  return { ok:true, userId };
}

// ====== ORDER PARSER ======

// Tiny helpers
function pickAfter(lines, re){
  for (const ln of lines) { const m = ln.match(re); if (m && m[1]) return m[1].trim(); }
  return '';
}
function looksLikeSizeLine(ln){
  const L = ln.toLowerCase();
  if (/(?:\d+(?:\.\d+)?)\s*\*\s*(?:\d+(?:\.\d+)?)/.test(L)) return true; // 12*16
  if (/(?:print|white|black|color|printed)/.test(L)) return true;
  if (/\b(?:pcs|pieces|pis|টি)\b/.test(L)) return true;
  return false;
}
function findPiecesInLine(ln){
  const L = bnToEnDigits(ln.toLowerCase());
  const m = L.match(/(^|\s)([1-9][0-9]{0,4})\s*(?:pcs|pieces|pis|টি)\b/);
  return m ? parseInt(m[2],10) : null;
}
function safeEval(expr){
  const cleaned = expr.replace(/[^0-9.+\-*/() ]/g,'');
  try{ const out = Function('"use strict";return ('+cleaned+')')(); if (typeof out === 'number' && isFinite(out)) return out; }catch(_){}
  return null;
}

// Parse order (BN/EN, labeled/unlabeled, jumbled lines)
export function parseOrderMessage(raw=""){
  const textAll = bnToEnDigits(String(raw).replace(/\r/g,'')).trim();
  const linesRaw = textAll.split('\n').map(s=>s.trim()).filter(Boolean);
  const lines = linesRaw.map(s=>s.replace(/[|]/g,':'));

  // Phone
  let phone =
    pickAfter(lines, /(?:মোবাইল(?: নাম্বার)?|ফোন|phone|mobile)\s*[:\-]\s*([+()\-0-9\s]+)/i) ||
    (textAll.match(/(?:^|\D)(\+?8?8?0?1[\d\-\s]{8,})(?:\D|$)/)?.[1] ?? '');
  phone = normalizeBdPhone(phone);

  // Name
  let name = pickAfter(lines, /(?:নাম|name)\s*[:\-]\s*(.+)/i);
  if (!name){
    for (const ln of lines){
      if (ln.includes(phone)) continue;
      if (/(?:total|মোট)/i.test(ln)) continue;
      if (looksLikeSizeLine(ln)) continue;
      if (findPiecesInLine(ln) !== null) continue;
      if (/^\d/.test(ln)) continue;
      if (/^[a-z\s\u0980-\u09FF.]{2,40}$/i.test(ln) && ln.split(/\s+/).length <= 4){ name = ln.trim(); break; }
    }
  }

  // Address
  let address = pickAfter(lines, /(?:ঠিকানা|address)\s*[:\-]\s*(.+)/i);
  if (!address){
    const candidates = lines.filter(ln=>{
      if (/(?:total|মোট)/i.test(ln)) return false;
      if (looksLikeSizeLine(ln)) return false;
      if (findPiecesInLine(ln) !== null) return false;
      if (ln === name || ln.includes(phone)) return false;
      return ln.length >= 8;
    });
    address = candidates.sort((a,b)=>b.length-a.length)[0] || '';
  }

  // Size/spec
  let size = pickAfter(lines, /(?:সাইজ|size)\s*[:\-]\s*(.+)/i);
  if (!size){ size = lines.filter(looksLikeSizeLine).join(', '); }

  // Pieces
  let piecesStr = pickAfter(lines, /(?:কতগুলো(?:\s*নিবেন)?|amount|qty|quantity)\s*[:\-]\s*([0-9]+)/i);
  let pieces = piecesStr ? parseInt(piecesStr,10) : null;
  if (pieces == null){
    for (const ln of lines){ const n = findPiecesInLine(ln); if (n != null){ pieces = n; break; } }
  }
  if (pieces == null){
    const qtys = [];
    for (const ln of lines){
      if (!looksLikeSizeLine(ln)) continue;
      const matches = [...bnToEnDigits(ln).matchAll(/(^|\D)([1-9][0-9]{0,4})\s*(?:pcs|pieces|pis|টি)\b/gi)];
      for (const m of matches) qtys.push(parseInt(m[2],10));
    }
    if (qtys.length) pieces = qtys.reduce((a,b)=>a+b,0);
  }
  if (pieces == null) pieces = '';

  // COD / Total
  let cod = '';
  const totalIdx = lines.findIndex(ln => /(?:total|মোট)/i.test(ln));
  if (totalIdx >= 0){
    const totalLine = lines[totalIdx].toLowerCase();
    const eqMatch = totalLine.match(/= *([0-9][0-9,]*(?:\.[0-9]+)?)(?!.*=)/);
    if (eqMatch) cod = eqMatch[1];
    if (!cod){
      for (let i=totalIdx+1; i<Math.min(totalIdx+3,lines.length); i++){
        const mm = lines[i].toLowerCase().match(/(^|\s)([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:tk|taka|টাকা)?\b/);
        if (mm){ cod = mm[2]; break; }
      }
    }
    if (!cod){
      const beforeEq = totalLine.split('=')[0];
      const afterColon = beforeEq.split(':').slice(1).join(':').trim();
      const val = safeEval(afterColon);
      if (val != null) cod = String(val);
    }
  }
  if (!cod){
    const eqLast = textAll.toLowerCase().match(/= *([0-9][0-9,]*(?:\.[0-9]+)?)(?![\s\S]*=)/);
    if (eqLast) cod = eqLast[1];
  }
  if (!cod){
    const m = textAll.toLowerCase().match(/(?:total|মোট)\s*[:=]\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
    if (m) cod = m[1];
  }
  if (cod) cod = cod.replace(/,/g,'').replace(/\s*(?:tk|taka|টাকা)\b/i,'');

  const codAmount = cod ? Number(cod) : '';

  return { name: name||'', phone: phone||'', address: address||'', size: size||'', pieces: pieces||'', codAmount: codAmount||'', raw };
}

export function buildAutofillPayload(o){
  const clean = (s)=>String(s||'').trim();
  return JSON.stringify({
    name: clean(o.name),
    phone: clean(o.phone),
    address: clean(o.address),
    size: clean(o.size),
    pieces: String(o.pieces ?? '').trim(),
    codAmount: String(o.codAmount ?? '').trim()
  });
}

// ------------- Simple per-user KV -------------
export const store = {
  async setUserKV(userId, key, value){
    await setDoc(doc(db, "users", userId, "kv", key), { value });
  },
  subscribeUserKV(userId, key, cb){
    return onSnapshot(doc(db, "users", userId, "kv", key), snap => cb(snap.exists() ? snap.data().value : undefined));
  }
};

// ====== SECURE KEY STORAGE (AES-GCM with passphrase) ======
const te = new TextEncoder();
const td = new TextDecoder();

function b64e(buf){ let s=''; const b=new Uint8Array(buf); for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); }
function b64d(str){ const bin=atob(str); const out=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out; }

async function deriveKey(passphrase, userId){
  const salt = te.encode(`pw:${userId}:steadfast`);
  const base = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt, iterations:100000, hash:'SHA-256' },
    base,
    { name:'AES-GCM', length:256 },
    false,
    ['encrypt','decrypt']
  );
}

async function encryptObject(userId, passphrase, obj){
  const key = await deriveKey(passphrase, userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = te.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, pt);
  return { v:1, iv: b64e(iv), ct: b64e(ct), ts: new Date().toISOString() };
}

async function decryptObject(userId, passphrase, enc){
  const key = await deriveKey(passphrase, userId);
  const iv = b64d(enc.iv);
  const ct = b64d(enc.ct);
  const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, ct);
  return JSON.parse(td.decode(pt));
}

// Public API for Steadfast keys
export async function saveSteadfastKeys(userId, passphrase, { apiKey, secretKey }, profile){
  const payload = { apiKey: String(apiKey||'').trim(), secretKey: String(secretKey||'').trim() };
  if (!payload.apiKey || !payload.secretKey) throw new Error('API Key and Secret Key required');
  const enc = await encryptObject(userId, passphrase, payload);
  await setDoc(doc(db, "users", userId, "kv", "steadfast.keys"), enc);
  // optional profile (non-secret)
  const prof = {
    companyName: String(profile?.companyName||'').trim(),
    ownerName:   String(profile?.ownerName||'').trim(),
    merchantId:  String(profile?.merchantId||'').trim(),
    balance:     profile?.balance ?? null,
    updatedAt:   new Date().toISOString()
  };
  await setDoc(doc(db, "users", userId, "kv", "steadfast.profile"), prof);
  return true;
}

export async function hasSteadfastKeys(userId){
  return (await getDoc(doc(db, "users", userId, "kv", "steadfast.keys"))).exists();
}

export async function unlockSteadfastKeys(userId, passphrase){
  const snap = await getDoc(doc(db, "users", userId, "kv", "steadfast.keys"));
  if (!snap.exists()) throw new Error('No keys saved');
  return decryptObject(userId, passphrase, snap.data());
}

export async function getSteadfastProfile(userId){
  const snap = await getDoc(doc(db, "users", userId, "kv", "steadfast.profile"));
  return snap.exists() ? snap.data() : {};
}

// ====== PROXY CALLS ======
const VERIFY = '/api/steadfastVerify';
const PLACE  = '/api/steadfastPlaceOrder';

export async function verifySteadfastKeys(apiKey, secretKey){
  const res = await fetch(VERIFY, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ apiKey, secretKey })
  });
  const json = await res.json().catch(()=>({}));
  return json?.ok ? { ok:true, profile: json.profile||{} } : { ok:false, message: json?.message || 'Verify failed' };
}

export async function placeSteadfastOrder(userId, passphrase, order){
  const keys = await unlockSteadfastKeys(userId, passphrase);
  const res  = await fetch(PLACE, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ apiKey: keys.apiKey, secretKey: keys.secretKey, order })
  });
  const json = await res.json().catch(()=>({}));
  if (!json?.ok) throw new Error(json?.message || 'Steadfast error');
  return json.result;
}
