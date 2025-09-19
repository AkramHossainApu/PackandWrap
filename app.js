// ================================
// app.js  (ES module)
// - Forces HTTPS (fixes incognito/HTTP hash mismatch)
// - Firestore storage
// - Canonical usernames (trim+lower)
// - Robust SHA-256 (with fallback)
// - Per-user isolated KV data (products, sales, etc.)
// - Exposes renderTypes/renderSizes/renderColors on window for non-module page
// ================================

// ---------- HTTPS redirect (critical for consistent hashing) ----------
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  location.replace('https://' + location.host + location.pathname + location.search + location.hash);
}

// ---------- Firebase Init ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot
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
const $$ = s => document.querySelectorAll(s);
const today = () => new Date().toISOString().slice(0,10);
const TK = n => `${Number(n||0).toLocaleString('en-US')} TK`;

// Robust SHA-256 with fallback (for older/non-secure contexts)
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
      H4=0x510e527f, H5=0x9b05688c, H6=0x1f83d9ab, H7=0x5be0cd19;
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

// =============== USER-BASED DATA STORAGE ===============
// Every user has their own namespace in Firestore
function userDoc(userId, key){
  return doc(db, "userData", userId, "kv", key);
}

const store = {
  get(k, d){
    try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
  },
  async setUser(userId, k, v){
    localStorage.setItem(`${userId}_${k}`, JSON.stringify(v));
    await setDoc(userDoc(userId,k), { value: v });
  },
  subscribeUser(userId, k, defaultVal){
    const refDoc = userDoc(userId,k);
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

// ---------- Keys ----------
const K_PRODUCTS   = 'pw_products';
const K_INV        = 'pw_investments';
const K_SALES      = 'pw_sales';
const K_EXP        = 'pw_expenses';
const K_COLLAPSE   = 'pw_collapsed_types';
const K_COLLCOLOR  = 'pw_collapsed_colors';
const K_TYPES      = 'pw_attr_types';
const K_SIZES      = 'pw_attr_sizes';
const K_COLORS     = 'pw_attr_colors';

// ---------- Users (Firestore `users` collection) ----------
// Doc id = userId (unique), username is not required to be unique
// { userId, username, usernameLower, passwordHash, createdAt }
export async function addUser(username, password, userId){
  const canonical = canonicalUsername(username);
  const display   = displayUsername(username);
  if (!canonical) throw new Error('Username required');
  if (!userId) throw new Error('UserID required');

  const userRef  = doc(db, "users", userId);
  const snap     = await getDoc(userRef);
  if(snap.exists()) throw new Error("UserID already exists");

  const passHash = await sha(password);
  await setDoc(userRef, {
    userId,
    username: display,
    usernameLower: canonical,
    passwordHash: passHash,
    createdAt: new Date().toISOString()
  });
}

export async function loginUser(username, password){
  const canonical = canonicalUsername(username);
  const passHash  = await sha(password);

  // Find user by scanning all with same canonical username
  // (username not unique, must match with passwordHash)
  // In production you'd index query, but for demo we fetch by canonical
  // and check password.
  const userListRef = doc(db, "users_index", canonical);
  const snap = await getDoc(userListRef);
  if(!snap.exists()) return false;

  const candidates = snap.data().userIds || [];
  for(const uid of candidates){
    const ref = doc(db,"users",uid);
    const uSnap = await getDoc(ref);
    if(uSnap.exists() && uSnap.data().passwordHash === passHash){
      return uid; // return logged in userId
    }
  }
  return false;
}
// ---------- Seed (local cache only) ----------
function seed(userId){
  const may = (k)=>{ if(!store.get(`${userId}_${k}`)) localStorage.setItem(`${userId}_${k}`, JSON.stringify([])); };
  may(K_PRODUCTS); may(K_INV); may(K_SALES); may(K_EXP);
  may(K_COLLAPSE); may(K_COLLCOLOR); may(K_TYPES); may(K_SIZES); may(K_COLORS);
}

// Live-sync from Firestore -> local cache
function subscribeUserData(userId){
  store.subscribeUser(userId, K_PRODUCTS,   []);
  store.subscribeUser(userId, K_INV,        []);
  store.subscribeUser(userId, K_SALES,      []);
  store.subscribeUser(userId, K_EXP,        []);
  store.subscribeUser(userId, K_COLLAPSE,   []);
  store.subscribeUser(userId, K_COLLCOLOR,  []);
  store.subscribeUser(userId, K_TYPES,      []);
  store.subscribeUser(userId, K_SIZES,      []);
  store.subscribeUser(userId, K_COLORS,     []);
}

// ---------- Shortcuts ----------
function P(userId){ return store.get(`${userId}_${K_PRODUCTS}`,[]); }
function INV(userId){ return store.get(`${userId}_${K_INV}`,[]); }
function S(userId){ return store.get(`${userId}_${K_SALES}`,[]); }
function EXP(userId){ return store.get(`${userId}_${K_EXP}`,[]); }
function collapsedTypes(userId){ return store.get(`${userId}_${K_COLLAPSE}`,[]); }
function setCollapsedTypes(userId,v){ return store.setUser(userId,K_COLLAPSE,v); }
function collapsedColors(userId){ return store.get(`${userId}_${K_COLLCOLOR}`,[]); }
function setCollapsedColors(userId,v){ return store.setUser(userId,K_COLLCOLOR,v); }

let types  = [];
let sizes  = [];
let colors = [];

const safe = v => (v ?? '').toString();
const uniqueKey = p => `${safe(p.type)}|${safe(p.size)}|${safe(p.color)}`;
const prodKey = p => `${p.size} | ${p.color}`;
function allKeys(userId){ return P(userId).map(prodKey); }
function findProduct(userId,key){
  const [size,color] = key.split(' | ');
  return P(userId).find(p=>p.size===size && p.color===color);
}

// ---------- Normalization ----------
function normalizeProducts(userId){
  let items = P(userId);
  let changed = false;

  items = items.map(p=>{
    const q = {...p};
    q.type  = safe(q.type);
    q.size  = safe(q.size);
    q.color = safe(q.color);
    q.buy1  = Number(q.buy1 ?? 0);
    q.sell1 = Number(q.sell1 ?? 0);
    if(q.lowest === '' || q.lowest === undefined) q.lowest = null;
    return q;
  });

  const map = new Map();
  for(const p of items){ map.set(uniqueKey(p), p); }
  const deduped = [...map.values()];
  if(deduped.length !== items.length){ changed = true; }

  if(changed) store.setUser(userId,K_PRODUCTS, deduped);
}

// ---------- Totals / Overview ----------
function totals(userId){
  const inv1 = INV(userId).filter(r=>r.batch==1).reduce((a,b)=>a+b.cost,0);
  const inv2 = INV(userId).filter(r=>r.batch==2).reduce((a,b)=>a+b.cost,0);
  const sell1 = S(userId).filter(r=>r.batch==1).reduce((a,b)=>a+b.price100*b.packs,0);
  const sell2 = S(userId).filter(r=>r.batch==2).reduce((a,b)=>a+b.price100*b.packs,0);
  const exp = EXP(userId).reduce((a,b)=>a+b.amount,0);
  const overall = (sell1+sell2) - (inv1+inv2) - exp;
  return {inv1,inv2,sell1,sell2,exp,overall};
}
function renderOverviewTotals(userId){
  const {inv1,inv2,sell1,sell2,exp,overall} = totals(userId);

  $('#tInv1') && ($('#tInv1').textContent = TK(inv1));
  $('#tInv2') && ($('#tInv2').textContent = TK(inv2));
  $('#tSell1') && ($('#tSell1').textContent = TK(sell1));
  $('#tSell2') && ($('#tSell2').textContent = TK(sell2));
  $('#tExp')  && ($('#tExp').textContent  = TK(exp));
  $('#tProfit') && ($('#tProfit').textContent = TK(overall));

  if($('#overallProfitChip')){
    const chip = $('#overallProfitChip');
    chip.textContent = overall >= 0 ? `Overall Profit: ${TK(overall)}` : `Overall Loss: ${TK(Math.abs(overall))}`;
    chip.className = 'chip ' + (overall >= 0 ? 'profit' : 'loss');
  }

  if($('#overviewHighlights')){
    const customers = new Set(S(userId).map(s=>s.customer)).size;
    $('#highlightCustomers').textContent = customers;

    const best = {};
    S(userId).forEach(s=>{ best[s.key]=(best[s.key]||0)+s.packs; });
    let top = Object.entries(best).sort((a,b)=>b[1]-a[1])[0];
    $('#highlightBest').textContent = top ? `${top[0]} (${top[1]} packs)` : '—';

    const low = allKeys(userId).filter(k=>{
      const purchased=INV(userId).filter(r=>r.key===k).reduce((a,b)=>a+b.packs,0);
      const sold=S(userId).filter(r=>r.key===k).reduce((a,b)=>a+b.packs,0);
      return purchased-sold < 3 && purchased > 0;
    });
    $('#highlightLow').textContent = low.length ? low.join(', ') : 'All OK';
  }

  if($('#chartProfit')) renderCharts(userId);
}

// ---------- Attribute dropdowns ----------
function refreshAttrListsFromStore(userId){
  types  = store.get(`${userId}_${K_TYPES}`, []);
  sizes  = store.get(`${userId}_${K_SIZES}`, []);
  colors = store.get(`${userId}_${K_COLORS}`, []);
}
function renderTypeSelect(userId, selected=''){
  refreshAttrListsFromStore(userId);
  return `<select class="type-select">
    ${types.map(t=>`<option ${t===selected?'selected':''}>${t}</option>`).join('')}
  </select>`;
}
function renderSizeSelect(userId, selected=''){
  refreshAttrListsFromStore(userId);
  return `<select class="size-select">
    ${sizes.map(s=>`<option ${s===selected?'selected':''}>${s}</option>`).join('')}
  </select>`;
}
function renderColorSelect(userId, selected=''){
  refreshAttrListsFromStore(userId);
  return `<select class="color-select">
    ${colors.map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('')}
  </select>`;
}
// ---------- Products Table ----------
function renderProducts(userId){
  const tb = $('#productTable tbody');
  if(!tb) return;

  const itemsSorted = [...P(userId)].sort((a,b)=>{
    return safe(a.type).localeCompare(safe(b.type))
        || safe(a.color).localeCompare(safe(b.color))
        || safe(a.size).localeCompare(safe(b.size));
  });

  const tCollapsed = new Set(collapsedTypes(userId));
  const cCollapsed = new Set(collapsedColors(userId));

  let html='';
  let currentType='';
  let currentColor='';

  const COLSPAN = 6;

  itemsSorted.forEach((p)=>{
    const uKey = uniqueKey(p);

    if(p.type!==currentType){
      currentType=p.type;
      currentColor='';
      const isTCol = tCollapsed.has(currentType);
      html += `
        <tr class="group-row" data-group="type" data-type="${currentType}">
          <td colspan="${COLSPAN}">
            <button class="btn ghost btnToggleType" data-type="${currentType}" type="button">${isTCol?'▸':'▾'}</button>
            <strong style="margin-left:6px">${currentType || '(No Type)'}</strong>
          </td>
        </tr>`;
    }

    if(p.color!==currentColor){
      currentColor=p.color;
      const key = `${currentType}||${currentColor}`;
      const isCCol = cCollapsed.has(key);
      const hiddenByType = tCollapsed.has(currentType) ? 'style="display:none"' : '';
      html += `
        <tr class="group-row sub" data-group="color" data-type="${currentType}" data-color="${currentColor}" ${hiddenByType}>
          <td colspan="${COLSPAN}">
            <button class="btn ghost btnToggleColor" data-type="${currentType}" data-color="${currentColor}" type="button">${isCCol?'▸':'▾'}</button>
            <span style="margin-left:6px"><em>${currentColor || '(No Variant)'}</em></span>
          </td>
        </tr>`;
    }

    const cKey = `${currentType}||${currentColor}`;
    const hidden = (tCollapsed.has(currentType) || cCollapsed.has(cKey)) ? 'style="display:none"' : '';
    const warn = p.lowest!=null && p.sell1 < p.lowest;

    html += `
      <tr data-row="item" data-type="${currentType}" data-color="${currentColor}" data-key="${uKey}" ${hidden}>
        <td>${p.size}</td>
        <td>${p.buy1} TK</td>
        <td>${p.sell1} TK</td>
        <td>${p.lowest!=null? (p.lowest+' TK') : '—'}</td>
        <td>${warn?'<span class="warn-badge">Below Market</span>':''}</td>
        <td>
          <button class="btn ghost btnEdit" type="button">Edit</button>
          <button class="btn danger btnDelete" type="button">Delete</button>
        </td>
      </tr>`;
  });

  tb.innerHTML=html;
  updateProductKeySelects(userId);
  attachProductSearch(userId);
}

// Add New Product row on top
document.addEventListener('click', (e)=>{
  const addBtn = e.target.closest('#btnAddProduct');
  if(!addBtn) return;
  const userId = localStorage.getItem("currentUser");
  const tb=$('#productTable tbody');
  if(!tb) return;
  if(tb.querySelector('tr[data-row="edit"][data-mode="new"]')) return;

  const tr=document.createElement('tr');
  tr.setAttribute('data-row','edit');
  tr.setAttribute('data-mode','new');

  tr.innerHTML=`
    <td>${renderSizeSelect(userId)}</td>
    <td><input type="number" step="0.01" class="inBuy" placeholder="Buy (1)"/></td>
    <td><input type="number" step="0.01" class="inSell" placeholder="Sell (1)"/></td>
    <td><input type="number" step="0.01" class="inLowest" placeholder="Lowest"/></td>
    <td></td>
    <td class="actions-cell">
      ${renderTypeSelect(userId)}
      ${renderColorSelect(userId)}
      <button class="btn primary btnSave" type="button">Save</button>
      <button class="btn ghost btnCancel" type="button">Cancel</button>
    </td>`;
  tb.prepend(tr);
});
// ---------- Backup / Export (per-user) ----------
$('#btnExport')?.addEventListener('click', ()=>{
  const userId = activeUserId(); if(!userId) return;
  const data={
    products:   P(userId),
    investments:INV(userId),
    sales:      S(userId),
    expenses:   EXP(userId),
    types:      store.get(`${userId}_${K_TYPES}`, []),
    sizes:      store.get(`${userId}_${K_SIZES}`, []),
    colors:     store.get(`${userId}_${K_COLORS}`, [])
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`packwrap-${userId}-backup-${today()}.json`; a.click();
});

// ---------- Import JSON (per-user) ----------
$('#fileImport')?.addEventListener('change', async e=>{
  const userId = activeUserId(); if(!userId) return;
  const f=e.target.files[0]; if(!f) return; const txt=await f.text(); const data=JSON.parse(txt);
  if(confirm('Import JSON and overwrite current data for this user?')){
    if(data.products)    await store.setUser(userId, K_PRODUCTS, data.products);
    if(data.investments) await store.setUser(userId, K_INV, data.investments);
    if(data.sales)       await store.setUser(userId, K_SALES, data.sales);
    if(data.expenses)    await store.setUser(userId, K_EXP, data.expenses);
    if(data.types)       await store.setUser(userId, K_TYPES, data.types);
    if(data.sizes)       await store.setUser(userId, K_SIZES, data.sizes);
    if(data.colors)      await store.setUser(userId, K_COLORS, data.colors);
    renderAll(userId);
  }
});

// ---------- CSV Import ----------
function parseCSV(text){
  const lines=text.trim().split(/\r?\n/); const head=lines.shift().split(',').map(h=>h.trim());
  return lines.filter(Boolean).map(l=>{
    const cells=l.split(',').map(x=>x.trim()); const o={}; head.forEach((h,i)=>o[h]=cells[i]); return o;
  });
}
$('#csvFile')?.addEventListener('change', async e=>{
  const userId = activeUserId(); if(!userId) return;
  const f=e.target.files[0]; if(!f) return; const type=$('#csvType').value;
  const rows=parseCSV(await f.text());
  if(type==='products'){
    const items=P(userId);
    rows.forEach(r=>{
      const obj={type:safe(r.type), size:safe(r.size), color:safe(r.color), buy1:Number(r.buy1), sell1:Number(r.sell1), lowest:r.lowest?Number(r.lowest):null};
      const i=items.findIndex(x=>uniqueKey(x)===uniqueKey(obj));
      if(i>-1) items[i]=obj; else items.push(obj);
    });
    await store.setUser(userId, K_PRODUCTS, items);
    normalizeProducts(userId);
  }else if(type==='investments'){
    const inv=INV(userId);
    rows.forEach(r=>{
      const key=`${r.size} | ${r.color}`, packs=Number(r.packs);
      inv.push({date:r.date,batch:Number(r.batch),key,packs,cost:costFor(userId,key,packs)});
    }); await store.setUser(userId, K_INV, inv);
  }else if(type==='sales'){
    const list=S(userId);
    rows.forEach(r=>{
      const key=`${r.size} | ${r.color}`, packs=Number(r.packs), price100=Number(r.price100)||defaultSell100(userId,key);
      list.push({date:r.date,customer:r.customer,key,packs,price100,batch:Number(r.batch),pay:r.pay||'Other',contact:'',estProfit:estProfit(userId,key,packs,price100)});
    }); await store.setUser(userId, K_SALES, list);
  }else if(type==='expenses'){
    const ex=EXP(userId);
    rows.forEach(r=>ex.push({date:r.date,type:r.type||'Other',desc:r.description||'',amount:Number(r.amountTK)}));
    await store.setUser(userId, K_EXP, ex);
  }
  renderAll(userId); alert('CSV import complete.');
});

// ---------- Manage Types/Sizes/Colors ----------
function renderList(userId, tableId, arr, onSave, inUseFn){
  const tb = $(tableId+' tbody');
  if(!tb) return;
  tb.innerHTML = arr.map((v,i)=>`
    <tr data-idx="${i}">
      <td>${v}</td>
      <td>
        <button class="btn ghost btnEdit">Edit</button>
        <button class="btn danger btnDelete">Delete</button>
      </td>
    </tr>`).join('');
  tb.onclick = async e=>{
    const tr=e.target.closest('tr'); if(!tr) return;
    const idx=Number(tr.dataset.idx);
    if(e.target.classList.contains('btnDelete')){
      const val = arr[idx];
      if(inUseFn && inUseFn(val)){ alert('Cannot delete: still used by one or more products.'); return; }
      if(confirm('Delete this?')){
        arr.splice(idx,1); onSave(arr);
        await store.setUser(userId, tableId.includes('type')?K_TYPES:tableId.includes('size')?K_SIZES:K_COLORS, arr);
        renderAll(userId); renderList(userId, tableId, arr, onSave, inUseFn);
      }
    }
    if(e.target.classList.contains('btnEdit')){
      const val=prompt('Rename:', arr[idx]);
      if(val && val.trim()){
        arr[idx]=val.trim(); onSave(arr);
        await store.setUser(userId, tableId.includes('type')?K_TYPES:tableId.includes('size')?K_SIZES:K_COLORS, arr);
        renderAll(userId); renderList(userId, tableId, arr, onSave, inUseFn);
      }
    }
  };
}

function attrInUseType(userId, val){ return P(userId).some(p=>p.type===val); }
function attrInUseSize(userId, val){ return P(userId).some(p=>p.size===val); }
function attrInUseColor(userId, val){ return P(userId).some(p=>p.color===val); }

function renderTypes(userId){
  types = store.get(`${userId}_${K_TYPES}`, types);
  renderList(userId, '#typeTable', types, v=>{ types=v; }, v=>attrInUseType(userId,v));
}
function renderSizes(userId){
  sizes = store.get(`${userId}_${K_SIZES}`, sizes);
  renderList(userId, '#sizeTable', sizes, v=>{ sizes=v; }, v=>attrInUseSize(userId,v));
}
function renderColors(userId){
  colors = store.get(`${userId}_${K_COLORS}`, colors);
  renderList(userId, '#colorTable', colors, v=>{ colors=v; }, v=>attrInUseColor(userId,v));
}

// expose for manage-attributes.html (non-module page calling these) – wrapped to use active user
Object.assign(window, {
  renderTypes:  ()=>{ const uid=activeUserId(); if(uid) renderTypes(uid); },
  renderSizes:  ()=>{ const uid=activeUserId(); if(uid) renderSizes(uid); },
  renderColors: ()=>{ const uid=activeUserId(); if(uid) renderColors(uid); }
});

// Quick-add buttons for attributes
$('#btnAddType')?.addEventListener('click', async ()=>{
  const uid=activeUserId(); if(!uid) return;
  const v=$('#newType').value.trim(); if(v){
    const list = store.get(`${uid}_${K_TYPES}`, []);
    if(!list.includes(v)) list.push(v);
    list.sort(); await store.setUser(uid, K_TYPES, list);
    $('#newType').value=''; renderTypes(uid); renderAll(uid);
  }
});
$('#btnAddSize')?.addEventListener('click', async ()=>{
  const uid=activeUserId(); if(!uid) return;
  const v=$('#newSize').value.trim(); if(v){
    const list = store.get(`${uid}_${K_SIZES}`, []);
    if(!list.includes(v)) list.push(v);
    list.sort(); await store.setUser(uid, K_SIZES, list);
    $('#newSize').value=''; renderSizes(uid); renderAll(uid);
  }
});
$('#btnAddColor')?.addEventListener('click', async ()=>{
  const uid=activeUserId(); if(!uid) return;
  const v=$('#newColor').value.trim(); if(v){
    const list = store.get(`${uid}_${K_COLORS}`, []);
    if(!list.includes(v)) list.push(v);
    list.sort(); await store.setUser(uid, K_COLORS, list);
    $('#newColor').value=''; renderColors(uid); renderAll(uid);
  }
});

// ========== Render & Nav & Session helpers ==========
function activeUserId(){
  return localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || null;
}

function renderAll(userId){
  if(!userId) return;
  normalizeProducts(userId);
  renderOverviewTotals(userId);

  if($('#productTable')) renderProducts(userId);
  if($('#invTable')) renderInvestments(userId);
  if($('#salesTable')) renderSales(userId);
  if($('#custTable')){
    $('#custMonth') && ($('#custMonth').value = new Date().toISOString().slice(0,7));
    renderCustomers(userId);
  }
  if($('#expTable')) renderExpenses(userId);

  $('#sale-date') && ($('#sale-date').value = today());
  $('#inv-date') && ($('#inv-date').value = today());
  $('#exp-date') && ($('#exp-date').value = today());
}

// Mobile nav + active tab
function setupNav(){
  const wrap   = document.querySelector('.tabs-wrap');
  const toggle = document.getElementById('navToggle');
  if (toggle && wrap){
    toggle.addEventListener('click', ()=> wrap.classList.toggle('open'));
  }

  const page = (location.pathname.split('/').pop() || 'overview.html').toLowerCase();
  document.querySelectorAll('.tabs a').forEach(a=>{
    const href = (a.getAttribute('href')||'').toLowerCase();
    if(href === page){
      a.classList.add('active');
    }else{
      a.classList.remove('active');
    }
  });
}

// Boot
document.addEventListener('DOMContentLoaded', ()=>{
  const uid=activeUserId();
  if(uid){
    // per-user init
    seed(uid);
    subscribeUserData(uid);
    renderAll(uid);
  }
  setupNav();
});
