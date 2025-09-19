// ================================
// app.js  (ES module)
// (Updated)
// - Adds userIDs registry + users_index updates on signup
// - Username canonicalization
// ================================

if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  location.replace('https://' + location.host + location.pathname + location.search + location.hash);
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD35RFbmf7vRPF1o_VbyEZ1K7wqAYeBhzA",
  authDomain: "packandwrap-web.firebaseapp.com",
  projectId: "packandwrap-web",
  storageBucket: "packandwrap-web.firebasestorage.app",
  messagingSenderId: "583470090860",
  appId: "1:583470090860:web:32c2d3b35d262a71fde649"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ---------- Helpers ----------
const $ = s => document.querySelector(s);
const today = () => new Date().toISOString().slice(0,10);
const TK = n => `${Number(n||0).toLocaleString('en-US')} TK`;

export async function sha(input){
  const enc = typeof TextEncoder !== 'undefined'
    ? new TextEncoder()
    : { encode: s => new Uint8Array(unescape(encodeURIComponent(s)).split('').map(c=>c.charCodeAt(0))) };

  const cryptoObj = (globalThis.crypto || globalThis.msCrypto);
  if (cryptoObj?.subtle?.digest) {
    const data = enc.encode(input);
    const buf = await cryptoObj.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  // ----- Pure JS SHA-256 fallback -----
  function R(n, x){ return (x>>>n) | (x<<(32-n)); }
  function toWords(bytes){
    const words = [];
    for (let i=0; i<bytes.length; i+=4){
      words.push((bytes[i]<<24) | (bytes[i+1]<<16) | (bytes[i+2]<<8) | (bytes[i+3]));
    }
    return words;
  }
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  let H0=0x6a09e667, H1=0xbb67ae85, H2=0x3c6ef372, H3=0xa54ff53a,
      H4=0x510e527f, H5=0x9b05688, H6=0x1f83d9ab, H7=0x5be0cd19;
  const bytes = Array.from((typeof TextEncoder !== 'undefined' ? new TextEncoder() : {encode:s=>new Uint8Array(unescape(encodeURIComponent(s)).split('').map(c=>c.charCodeAt(0))) }).encode(input));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (let i=7; i>=0; i--) bytes.push((bitLen >>> (i*8)) & 0xff);

  for (let i=0; i<bytes.length; i+=64){
    const chunk = bytes.slice(i, i+64);
    const w = new Array(64);
    const words = toWords(chunk);
    for (let t=0; t<16; t++) w[t] = words[t];
    for (let t=16; t<64; t++){
      const s0 = R(7,w[t-15]) ^ R(18,w[t-15]) ^ (w[t-15]>>>3);
      const s1 = R(17,w[t-2]) ^ R(19,w[t-2]) ^ (w[t-2]>>>10);
      w[t] = (w[t-16] + s0 + w[t-7] + s1) | 0;
    }
    let a=H0,b=H1,c=H2,d=H3,e=H4,f=H5,g=H6,h=H7;
    for (let t=0; t<64; t++){
      const S1 = R(6,e) ^ R(11,e) ^ R(25,e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = R(2,a) ^ R(13,a) ^ R(22,a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h=g; g=f; f=e; e=(d + temp1) | 0;
      d=c; c=b; b=a; a=(temp1 + temp2) | 0;
    }
    H0=(H0+a)|0; H1=(H1+b)|0; H2=(H2+c)|0; H3=(H3+d)|0;
    H4=(H4+e)|0; H5=(H5+f)|0; H6=(H6+g)|0; H7=(H7+h)|0;
  }
  return [H0,H1,H2,H3,H4,H5,H6,H7].map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}

// Username canonicalization
function canonicalUsername(u){ return (u||'').trim().toLowerCase(); }
function displayUsername(u){  return (u||'').trim(); }

// ====== Minimal user KV helpers ======
const store = {
  get(k, d){
    try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
  },
  async setUser(userId, k, v){
    localStorage.setItem(`${userId}_${k}`, JSON.stringify(v));
    await setDoc(doc(db, "userData", userId, "kv", k), { value: v });
  },
  subscribeUser(userId, k, defaultVal){
    const refDoc = doc(db, "userData", userId, "kv", k);
    onSnapshot(refDoc, snap=>{
      if(snap.exists()){
        localStorage.setItem(`${userId}_${k}`, JSON.stringify(snap.data().value));
      }else if(defaultVal !== undefined){
        localStorage.setItem(`${userId}_${k}`, JSON.stringify(defaultVal));
      }
      renderAll();
    }, err=> console.warn("Firestore subscribe error:", err));
  }
};

// ---------- Users (Firestore `users` collection) ----------
export async function addUser(username, password, userId){
  const canonical = canonicalUsername(username);
  const display   = displayUsername(username);
  if (!canonical) throw new Error('Username required');
  if (!userId) throw new Error('UserID required');

  const userRef  = doc(db, "users", userId);
  const uidRef   = doc(db, "userIDs", userId);

  // Existence checks
  const snap     = await getDoc(userRef);
  const uidSnap  = await getDoc(uidRef);
  if(snap.exists() || uidSnap.exists()) {
    throw new Error("UserID already exists");
  }

  const passHash = await sha(password);
  const now = new Date().toISOString();

  // Create user
  await setDoc(userRef, {
    userId,
    username: display,
    usernameLower: canonical,
    passwordHash: passHash,
    createdAt: now
  });

  // Reserve the userId
  await setDoc(uidRef, { usernameLower: canonical, createdAt: now });

  // Add to username index
  const idxRef = doc(db, "users_index", canonical);
  try {
    await updateDoc(idxRef, { userIds: arrayUnion(userId) });
  } catch {
    // If the document doesn't exist yet, create it
    await setDoc(idxRef, { userIds: [userId] }, { merge: true });
  }
}

// ---- (Keep the rest of your non-signup app code as-is) ----
function activeUserId(){
  return localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || null;
}
function renderAll(userId){
  // keep your existing rendering logic
}
function setupNav(){
  const wrap   = document.querySelector('.tabs-wrap');
  const toggle = document.getElementById('navToggle');
  if (toggle && wrap){
    toggle.addEventListener('click', ()=> wrap.classList.toggle('open'));
  }
}
document.addEventListener('DOMContentLoaded', ()=>{
  const uid=activeUserId();
  if(uid){
    // init per-user data listeners if needed
  }
  setupNav();
});
