// ================================
// app.js  (ES module)
// - Forces HTTPS (fixes incognito/HTTP hash mismatch)
// - Firestore storage
// - Canonical usernames (trim+lower)
// - Robust SHA-256 (with fallback)
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

// Username canonicalization (prevents case/space login mismatches)
function canonicalUsername(u){ return (u||'').trim().toLowerCase(); }
function displayUsername(u){  return (u||'').trim(); }

// ---------- Firestore-backed KV Store (with local cache) ----------
const KV_COLLECTION = "kv";
const store = {
  get(k, d){
    try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
  },
  async set(k, v){
    localStorage.setItem(k, JSON.stringify(v));
    await setDoc(doc(db, KV_COLLECTION, k), { value: v });
  },
  subscribe(k, defaultVal){
    const refDoc = doc(db, KV_COLLECTION, k);
    onSnapshot(refDoc, snap=>{
      if(snap.exists()){
        localStorage.setItem(k, JSON.stringify(snap.data().value));
      }else if(defaultVal !== undefined){
        localStorage.setItem(k, JSON.stringify(defaultVal));
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
// Doc id = canonical username (lowercase, trimmed)
// { username: (display), usernameLower, passwordHash, createdAt }
export async function addUser(username, password){
  const id       = canonicalUsername(username);
  const display  = displayUsername(username);
  if (!id) throw new Error('Username required');

  const userRef  = doc(db, "users", id);
  const snap     = await getDoc(userRef);
  if(snap.exists()) throw new Error("Username already exists");

  const passHash = await sha(password);
  await setDoc(userRef, {
    username: display,
    usernameLower: id,
    passwordHash: passHash,
    createdAt: new Date().toISOString()
  });
}

export async function loginUser(username, password){
  const id       = canonicalUsername(username);
  const passHash = await sha(password);

  // Try canonical doc id first
  let ref  = doc(db, "users", id);
  let snap = await getDoc(ref);

  // Backward-compat: if not found, try exact typed username (legacy accounts)
  if(!snap.exists()){
    const legacyRef = doc(db, "users", displayUsername(username));
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) snap = legacySnap;
  }

  if(!snap.exists()) return false;
  const data = snap.data();
  return data.passwordHash === passHash;
}

// ---------- Seed (local cache only) ----------
function seed(){
  const may = (k)=>{ if(!store.get(k)) localStorage.setItem(k, JSON.stringify([])); };
  may(K_PRODUCTS); may(K_INV); may(K_SALES); may(K_EXP);
  may(K_COLLAPSE); may(K_COLLCOLOR); may(K_TYPES); may(K_SIZES); may(K_COLORS);
}
seed();

// Live-sync from Firestore -> local cache
store.subscribe(K_PRODUCTS,   []);
store.subscribe(K_INV,        []);
store.subscribe(K_SALES,      []);
store.subscribe(K_EXP,        []);
store.subscribe(K_COLLAPSE,   []);
store.subscribe(K_COLLCOLOR,  []);
store.subscribe(K_TYPES,      []);
store.subscribe(K_SIZES,      []);
store.subscribe(K_COLORS,     []);

// ---------- Shortcuts ----------
const P   = ()=>store.get(K_PRODUCTS,[]);
const INV = ()=>store.get(K_INV,[]);
const S   = ()=>store.get(K_SALES,[]);
const EXP = ()=>store.get(K_EXP,[]);
const collapsedTypes     = () => store.get(K_COLLAPSE,[]);
const setCollapsedTypes  = v => store.set(K_COLLAPSE, v);
const collapsedColors    = () => store.get(K_COLLCOLOR,[]);
const setCollapsedColors = v => store.set(K_COLLCOLOR, v);

let types  = store.get(K_TYPES, []);
let sizes  = store.get(K_SIZES, []);
let colors = store.get(K_COLORS, []);

const safe = v => (v ?? '').toString();
const uniqueKey = p => `${safe(p.type)}|${safe(p.size)}|${safe(p.color)}`;
const prodKey = p => `${p.size} | ${p.color}`;
const allKeys = ()=>P().map(prodKey);
const findProduct = key => {
  const [size,color] = key.split(' | ');
  return P().find(p=>p.size===size && p.color===color);
};

// ---------- Normalization ----------
function normalizeProducts(){
  let items = store.get(K_PRODUCTS, []);
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

  if(changed) store.set(K_PRODUCTS, deduped);
}

// ---------- Totals / Overview ----------
function totals(){
  const inv1 = INV().filter(r=>r.batch==1).reduce((a,b)=>a+b.cost,0);
  const inv2 = INV().filter(r=>r.batch==2).reduce((a,b)=>a+b.cost,0);
  const sell1 = S().filter(r=>r.batch==1).reduce((a,b)=>a+b.price100*b.packs,0);
  const sell2 = S().filter(r=>r.batch==2).reduce((a,b)=>a+b.price100*b.packs,0);
  const exp = EXP().reduce((a,b)=>a+b.amount,0);
  const overall = (sell1+sell2) - (inv1+inv2) - exp;
  return {inv1,inv2,sell1,sell2,exp,overall};
}
function renderOverviewTotals(){
  const {inv1,inv2,sell1,sell2,exp,overall} = totals();

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
    const customers = new Set(S().map(s=>s.customer)).size;
    $('#highlightCustomers').textContent = customers;

    const best = {};
    S().forEach(s=>{ best[s.key]=(best[s.key]||0)+s.packs; });
    let top = Object.entries(best).sort((a,b)=>b[1]-a[1])[0];
    $('#highlightBest').textContent = top ? `${top[0]} (${top[1]} packs)` : '—';

    const low = allKeys().filter(k=>{
      const purchased=INV().filter(r=>r.key===k).reduce((a,b)=>a+b.packs,0);
      const sold=S().filter(r=>r.key===k).reduce((a,b)=>a+b.packs,0);
      return purchased-sold < 3 && purchased > 0;
    });
    $('#highlightLow').textContent = low.length ? low.join(', ') : 'All OK';
  }

  if($('#chartProfit')) renderCharts();
}

// ---------- Attribute dropdowns ----------
function refreshAttrListsFromStore(){
  types  = store.get(K_TYPES, []);
  sizes  = store.get(K_SIZES, []);
  colors = store.get(K_COLORS, []);
}
function renderTypeSelect(selected=''){
  refreshAttrListsFromStore();
  return `<select class="type-select">
    ${types.map(t=>`<option ${t===selected?'selected':''}>${t}</option>`).join('')}
  </select>`;
}
function renderSizeSelect(selected=''){
  refreshAttrListsFromStore();
  return `<select class="size-select">
    ${sizes.map(s=>`<option ${s===selected?'selected':''}>${s}</option>`).join('')}
  </select>`;
}
function renderColorSelect(selected=''){
  refreshAttrListsFromStore();
  return `<select class="color-select">
    ${colors.map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('')}
  </select>`;
}

function updateProductKeySelects(){
  const opts = allKeys().map(k=>`<option>${k}</option>`).join('');
  $('#inv-product') && ($('#inv-product').innerHTML = opts);
  $('#sale-product') && ($('#sale-product').innerHTML = opts);
}

// ---------- Products Table ----------
function renderProducts(){
  const tb = $('#productTable tbody');
  if(!tb) return;

  const itemsSorted = [...P()].sort((a,b)=>{
    return safe(a.type).localeCompare(safe(b.type))
        || safe(a.color).localeCompare(safe(b.color))
        || safe(a.size).localeCompare(safe(b.size));
  });

  const tCollapsed = new Set(collapsedTypes());
  const cCollapsed = new Set(collapsedColors());

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
  updateProductKeySelects();
  attachProductSearch();
}

// Add New Product row on top
document.addEventListener('click', (e)=>{
  const addBtn = e.target.closest('#btnAddProduct');
  if(!addBtn) return;

  const tb=$('#productTable tbody');
  if(!tb) return;
  if(tb.querySelector('tr[data-row="edit"][data-mode="new"]')) return;

  const tr=document.createElement('tr');
  tr.setAttribute('data-row','edit');
  tr.setAttribute('data-mode','new');

  tr.innerHTML=`
    <td>${renderSizeSelect()}</td>
    <td><input type="number" step="0.01" class="inBuy" placeholder="Buy (1)"/></td>
    <td><input type="number" step="0.01" class="inSell" placeholder="Sell (1)"/></td>
    <td><input type="number" step="0.01" class="inLowest" placeholder="Lowest"/></td>
    <td></td>
    <td class="actions-cell">
      ${renderTypeSelect()}
      ${renderColorSelect()}
      <button class="btn primary btnSave" type="button">Save</button>
      <button class="btn ghost btnCancel" type="button">Cancel</button>
    </td>`;
  tb.prepend(tr);
});

// Table actions
document.addEventListener('click', async (e)=>{
  const table = e.target.closest('#productTable');
  if(!table) return;

  const tr = e.target.closest('tr');

  // Toggle TYPE
  const tBtn = e.target.closest('.btnToggleType');
  if(tBtn){
    const type=tBtn.getAttribute('data-type');
    const setCol=new Set(collapsedTypes());
    if(setCol.has(type)) setCol.delete(type); else setCol.add(type);
    await setCollapsedTypes([...setCol]);
    renderProducts();
    return;
  }

  // Toggle COLOR
  const cBtn = e.target.closest('.btnToggleColor');
  if(cBtn){
    const type=cBtn.getAttribute('data-type');
    const color=cBtn.getAttribute('data-color');
    const key=`${type}||${color}`;
    const setCol=new Set(collapsedColors());
    if(setCol.has(key)) setCol.delete(key); else setCol.add(key);
    await setCollapsedColors([...setCol]);
    renderProducts();
    return;
  }

  // Edit
  const editBtn = e.target.closest('.btnEdit');
  if(editBtn){
    const arr = P();
    const uKey = tr.getAttribute('data-key');
    const idx = arr.findIndex(x=> uniqueKey(x)===uKey);
    if(idx < 0) return;
    const p = arr[idx];

    tr.setAttribute('data-row','edit');
    tr.setAttribute('data-mode','edit');
    tr.setAttribute('data-key', uKey);
    tr.innerHTML=`
      <td>${renderSizeSelect(p.size)}</td>
      <td><input type="number" step="0.01" class="inBuy" value="${p.buy1}"/></td>
      <td><input type="number" step="0.01" class="inSell" value="${p.sell1}"/></td>
      <td><input type="number" step="0.01" class="inLowest" value="${p.lowest??''}"/></td>
      <td></td>
      <td class="actions-cell">
        ${renderTypeSelect(p.type)}
        ${renderColorSelect(p.color)}
        <button class="btn primary btnSave" type="button">Save</button>
        <button class="btn ghost btnCancel" type="button">Cancel</button>
      </td>`;
    return;
  }

  // Cancel
  const cancelBtn = e.target.closest('.btnCancel');
  if(cancelBtn){
    renderProducts();
    return;
  }

  // Delete by stable key
  const delBtn = e.target.closest('.btnDelete');
  if(delBtn){
    const arr = P();
    const uKey = tr.getAttribute('data-key');
    const realIdx = arr.findIndex(x=> uniqueKey(x)===uKey);
    if(realIdx>-1 && confirm('Are you sure you want to delete this product?')){
      arr.splice(realIdx,1);
      await store.set(K_PRODUCTS,arr);
      renderAll();
    }
    return;
  }

  // Save (new or edit)
  const saveBtn = e.target.closest('.btnSave');
  if(saveBtn){
    const mode   = tr.getAttribute('data-mode');
    const oldKey = tr.getAttribute('data-key');

    let typeSel  = tr.querySelector('.type-select')?.value;
    let colorSel = tr.querySelector('.color-select')?.value;
    let sizeSel  = tr.querySelector('.size-select')?.value;

    refreshAttrListsFromStore();

    if(!types.includes(typeSel) || !sizes.includes(sizeSel) || !colors.includes(colorSel)){
      alert('Please select valid Type, Size, and Color from the lists. To add new ones, use “Manage Types & Sizes”.');
      return;
    }

    const buy = Number(tr.querySelector('.inBuy')?.value);
    const sell = Number(tr.querySelector('.inSell')?.value);
    const lowestRaw = tr.querySelector('.inLowest')?.value ?? '';
    const lowest = lowestRaw === '' ? null : Number(lowestRaw);

    if(Number.isNaN(buy) || Number.isNaN(sell)){
      alert('Please enter valid Buy and Sell prices.');
      return;
    }

    const product = { type:typeSel, size:sizeSel, color:colorSel, buy1:buy, sell1:sell, lowest };
    const newKey = uniqueKey(product);
    const arr = P();

    if(mode==='edit'){
      const i = arr.findIndex(x=> uniqueKey(x)===oldKey);
      if(i<0){ renderAll(); return; }

      const existsIdx = arr.findIndex(x=> uniqueKey(x)===newKey);
      if(existsIdx>-1 && existsIdx!==i){
        arr[existsIdx] = product;
        arr.splice(i,1);
      }else{
        arr[i] = product;
      }
      await store.set(K_PRODUCTS, arr);

    }else{ // new
      const existsIdx = arr.findIndex(x=> uniqueKey(x)===newKey);
      if(existsIdx>-1){
        arr[existsIdx] = product;
      }else{
        arr.push(product);
      }
      await store.set(K_PRODUCTS, arr);
    }

    renderAll();
    return;
  }
});

// ---------- Investments & Inventory ----------
function costFor(key,packs){ const p=findProduct(key); return p? p.buy1*100*packs : 0; }
function renderInvestments(){
  const tb = $('#invTable tbody'); if(!tb) return;

  $('#invForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const key=$('#inv-product').value, packs=Number($('#inv-packs').value);
    const batch=Number($('#inv-batch').value), date=$('#inv-date').value || today();
    const list=INV(); list.push({key,packs,batch,date,cost:costFor(key,packs)});
    await store.set(K_INV,list); e.target.reset(); renderAll();
  });

  tb.innerHTML = INV().map((r,i)=>`
    <tr><td>${r.date}</td><td>${r.batch==1?'1st':'2nd'}</td><td>${r.key}</td>
      <td>${r.packs}</td><td>${TK(r.cost)}</td>
      <td><button class="btn danger" data-rm="${i}">Delete</button></td></tr>`).join('');

  tb.addEventListener('click', async e=>{
    const idx=e.target.getAttribute('data-rm'); if(idx==null) return;
    const list=INV(); list.splice(Number(idx),1); await store.set(K_INV,list); renderAll();
  });

  const ib = $('#inventoryTable tbody');
  if(ib){
    const keys = allKeys();
    ib.innerHTML = keys.map(k=>{
      const purchased=INV().filter(r=>r.key===k).reduce((a,b)=>a+b.packs,0);
      const sold=S().filter(r=>r.key===k).reduce((a,b)=>a+b.packs,0);
      const [size,color]=k.split(' | ');
      return `<tr><td>${size}</td><td>${color}</td><td>${purchased}</td><td>${sold}</td><td>${purchased-sold}</td></tr>`;
    }).join('');
  }
}

// ---------- Sales ----------
function defaultSell100(key){ const p=findProduct(key); return p? p.sell1*100 : 0; }
function estProfit(key,packs,price100){
  const p=findProduct(key); if(!p) return 0;
  return price100*packs - (p.buy1*100*packs);
}
function renderSales(){
  if(!$('#salesTable')) return;

  $('#saleUseDefault')?.addEventListener('click', ()=>{
    const key=$('#sale-product').value; $('#sale-price100').value = defaultSell100(key);
  });

  $('#saleForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const key=$('#sale-product').value;
    const packs=Number($('#sale-packs').value);
    const price100= Number($('#sale-price100').value || defaultSell100(key));
    const date=$('#sale-date').value || today();
    const batch=Number($('#sale-batch').value);
    const customer=$('#sale-customer').value.trim();
    const contact=$('#sale-contact').value.trim();
    const pay=$('#sale-pay').value;

    const list=S();
    list.push({key,packs,price100,date,batch,customer,contact,pay,estProfit:estProfit(key,packs,price100)});
    await store.set(K_SALES,list);
    e.target.reset(); renderAll();
  });

  const month = $('#monthFilter')?.value;
  const rows = S().filter(s=>!month || s.date.startsWith(month))
                  .sort((a,b)=>b.date.localeCompare(a.date));
  $('#salesTable tbody').innerHTML = rows.map((s,i)=>`
    <tr>
      <td>${s.date}</td><td>${s.customer}</td><td>${s.key}</td>
      <td>${s.packs}</td><td>${TK(s.price100)}</td>
      <td>${TK(s.price100*s.packs)}</td><td>${TK(s.estProfit)}</td>
      <td>${s.batch==1?'1st':'2nd'}</td><td>${s.pay}</td>
      <td><button class="btn danger" data-del="${i}">Delete</button></td>
    </tr>`).join('');

  $('#monthFilter')?.addEventListener('change', renderSales);

  $('#salesTable tbody').addEventListener('click', async e=>{
    const idx=e.target.getAttribute('data-del'); if(idx==null) return;
    const list=S(); list.splice(Number(idx),1); await store.set(K_SALES,list); renderAll();
  });

  if($('#recentSales')){
    const recent = S().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
    $('#recentSales tbody').innerHTML = recent.map(s=>`
      <tr><td>${s.date}</td><td>${s.customer}</td><td>${s.key}</td>
      <td>${s.packs}</td><td>${TK(s.price100)}</td><td>${TK(s.estProfit)}</td></tr>`).join('');
  }

  if($('#chartProfit')) renderCharts();
}

// ---------- Charts ----------
function drawLine(canvasId, labels, values, title){
  const c=document.getElementById(canvasId); if(!c) return;
  const ctx=c.getContext('2d');
  const W=c.width=c.clientWidth, H=c.height=c.clientHeight, pad=30;
  ctx.clearRect(0,0,W,H);
  const max=Math.max(1,...values); const xstep=(W-pad*2)/Math.max(1,values.length-1);
  const y=v=> H-pad - (v/max)*(H-pad*2);
  ctx.beginPath();
  values.forEach((v,i)=>{const X=pad+i*xstep,Y=y(v); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y)}); ctx.strokeStyle="#fff"; ctx.stroke();
  ctx.fillStyle="#ddd"; ctx.fillText(title,10,14);
}
function drawBars(canvasId, labels, aVals, bVals, title){
  const c=document.getElementById(canvasId); if(!c) return;
  const ctx=c.getContext('2d');
  const W=c.width=c.clientWidth, H=c.height=c.clientHeight, pad=30;
  ctx.clearRect(0,0,W,H);
  const max=Math.max(1,...aVals,...bVals), n=labels.length;
  const bw=(W-pad*2)/Math.max(1,n)*.8, step=(W-pad*2)/Math.max(1,n), y=v=>H-pad-(v/max)*(H-pad*2);
  ctx.fillStyle="#ddd";
  for(let i=0;i<n;i++){
    const x=pad+i*step;
    ctx.fillRect(x, y(aVals[i]), bw/2, H-pad - y(aVals[i]));
    ctx.fillRect(x+bw/2+4, y(bVals[i]), bw/2, H-pad - y(bVals[i]));
  }
  ctx.fillText(title,10,14);
}
function renderCharts(){
  const dates = Array.from(new Set([...S().map(s=>s.date), ...EXP().map(e=>e.date)])).sort();
  const profitByDay = dates.map(d=>{
    const p=S().filter(s=>s.date===d).reduce((a,b)=>a+b.estProfit,0);
    const e=EXP().filter(x=>x.date===d).reduce((a,b)=>a+b.amount,0);
    return p-e;
  });
  drawLine('chartProfit', dates, profitByDay, 'Daily Profit (after expenses)');

  const months = Array.from(new Set([...S().map(s=>s.date.slice(0,7)), ...INV().map(i=>i.date.slice(0,7))])).sort();
  const salesM = months.map(m=>S().filter(s=>s.date.startsWith(m)).reduce((a,b)=>a+b.price100*b.packs,0));
  const invM   = months.map(m=>INV().filter(i=>i.date.startsWith(m)).reduce((a,b)=>a+b.cost,0));
  drawBars('chartSalesInv', months, salesM, invM, 'Sales vs Investment (Monthly)');
}

// ---------- Customers ----------
function renderCustomers(){
  if(!$('#custTable')) return;
  const month = $('#custMonth').value || new Date().toISOString().slice(0,7);
  const rows = S().filter(s=>s.date.startsWith(month));
  const sizesList = store.get(K_SIZES, []);
  const grouped = {};
  rows.forEach(s=>{
    const [size] = s.key.split(' | ');
    const k = `${s.date}|${s.customer}`;
    if(!grouped[k]) grouped[k]={date:s.date, name:s.customer, total:0, sizes:{}};
    grouped[k].total += s.price100*s.packs;
    grouped[k].sizes[size]=(grouped[k].sizes[size]||0)+s.packs;
  });
  let i=1;
  $('#custTable tbody').innerHTML = Object.values(grouped)
    .sort((a,b)=>a.date.localeCompare(b.date))
    .map(g=>{
      const cells = sizesList.map(sz=> g.sizes[sz]? `${g.sizes[sz]} (x100)` : '0').join('</td><td>');
      return `<tr><td>${g.date}</td><td>${i++}</td><td>${g.name}</td><td>${cells}</td><td>${TK(g.total)}</td></tr>`;
    }).join('');
  $('#custMonth')?.addEventListener('change', renderCustomers);
}

// ---------- Expenses / Boost ----------
function renderExpenses(){
  if(!$('#expTable')) return;
  $('#expForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const type=$('#exp-type').value, desc=$('#exp-desc').value.trim();
    const date=$('#exp-date').value||today(), amount=Number($('#exp-amount').value||0);
    const list=EXP(); list.push({type,desc,date,amount}); await store.set(K_EXP,list);
    e.target.reset(); renderAll();
  });
  $('#expAddRange')?.addEventListener('click', async ()=>{
    const from=new Date($('#exp-from').value), to=new Date($('#exp-to').value);
    const per=Number($('#exp-perday').value||0); if(!from||!to||!per) return alert('Set From, To and Per day.');
    const list=EXP(); const d=new Date(from);
    while(d<=to){ list.push({type:'Boost',desc:'Daily boost',date:d.toISOString().slice(0,10),amount:per}); d.setDate(d.getDate()+1); }
    await store.set(K_EXP,list); renderAll();
  });
  $('#expTable tbody').innerHTML = EXP().sort((a,b)=>b.date.localeCompare(a.date)).map((e,i)=>`
    <tr><td>${e.date}</td><td>${e.type}</td><td>${e.desc||''}</td><td>${TK(e.amount)}</td>
    <td><button class="btn danger" data-x="${i}">Delete</button></td></tr>`).join('');
  $('#expTable tbody').addEventListener('click', async e=>{
    const i=e.target.getAttribute('data-x'); if(i==null) return;
    const list=EXP(); list.splice(Number(i),1); await store.set(K_EXP,list); renderAll();
  });
}

// ---------- Backup / Import ----------
$('#btnExport')?.addEventListener('click', ()=>{
  const data={products:P(),investments:INV(),sales:S(),expenses:EXP()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`packwrap-backup-${today()}.json`; a.click();
});
$('#fileImport')?.addEventListener('change', async e=>{
  const f=e.target.files[0]; if(!f) return; const txt=await f.text(); const data=JSON.parse(txt);
  if(confirm('Import JSON and overwrite current data?')){
    if(data.products)   await store.set(K_PRODUCTS,data.products);
    if(data.investments)await store.set(K_INV,data.investments);
    if(data.sales)      await store.set(K_SALES,data.sales);
    if(data.expenses)   await store.set(K_EXP,data.expenses);
    renderAll();
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
  const f=e.target.files[0]; if(!f) return; const type=$('#csvType').value;
  const rows=parseCSV(await f.text());
  if(type==='products'){
    const items=P();
    rows.forEach(r=>{
      const obj={type:safe(r.type), size:safe(r.size), color:safe(r.color), buy1:Number(r.buy1), sell1:Number(r.sell1), lowest:r.lowest?Number(r.lowest):null};
      const i=items.findIndex(x=>uniqueKey(x)===uniqueKey(obj));
      if(i>-1) items[i]=obj; else items.push(obj);
    });
    await store.set(K_PRODUCTS, items);
    normalizeProducts();
  }else if(type==='investments'){
    const inv=INV();
    rows.forEach(r=>{
      const key=`${r.size} | ${r.color}`, packs=Number(r.packs);
      inv.push({date:r.date,batch:Number(r.batch),key,packs,cost:costFor(key,packs)});
    }); await store.set(K_INV,inv);
  }else if(type==='sales'){
    const list=S();
    rows.forEach(r=>{
      const key=`${r.size} | ${r.color}`, packs=Number(r.packs), price100=Number(r.price100)||defaultSell100(key);
      list.push({date:r.date,customer:r.customer,key,packs,price100,batch:Number(r.batch),pay:r.pay||'Other',contact:'',estProfit:estProfit(key,packs,price100)});
    }); await store.set(K_SALES,list);
  }else if(type==='expenses'){
    const ex=EXP(); rows.forEach(r=>ex.push({date:r.date,type:r.type||'Other',desc:r.description||'',amount:Number(r.amountTK)})); await store.set(K_EXP,ex);
  }
  renderAll(); alert('CSV import complete.');
});

// ---------- Search / Filter ----------
function attachProductSearch(){
  const input = $('#productSearch');
  if(!input) return;
  input.oninput = ()=>{
    const q = input.value.trim().toLowerCase();

    const itemRows   = $$('#productTable tbody tr[data-row="item"]');
    const typeHdrs   = $$('#productTable tbody tr[data-group="type"]');
    const colorHdrs  = $$('#productTable tbody tr[data-group="color"]');

    const tCollapsed = new Set(collapsedTypes());
    const cCollapsed = new Set(collapsedColors());

    if(!q){
      typeHdrs.forEach(h=>h.style.display='');
      colorHdrs.forEach(h=>{
        const type=h.getAttribute('data-type');
        h.style.display = tCollapsed.has(type) ? 'none' : '';
      });
      itemRows.forEach(r=>{
        const type=r.getAttribute('data-type');
        const color=r.getAttribute('data-color');
        const key=`${type}||${color}`;
        r.style.display = (tCollapsed.has(type) || cCollapsed.has(key)) ? 'none' : '';
      });
      return;
    }

    itemRows.forEach(r=>{
      const type  = (r.getAttribute('data-type')||'').toLowerCase();
      const color = (r.getAttribute('data-color')||'').toLowerCase();
      const size  = r.children[0]?.textContent.toLowerCase() || '';
      const match = type.includes(q) || color.includes(q) || size.includes(q);
      r.style.display = match ? '' : 'none';
    });

    colorHdrs.forEach(h=>{
      const type=h.getAttribute('data-type');
      const color=h.getAttribute('data-color');
      const hasVisible = Array.from(itemRows).some(r=>r.getAttribute('data-type')===type && r.getAttribute('data-color')===color && r.style.display!=='none');
      h.style.display = hasVisible ? '' : 'none';
    });

    typeHdrs.forEach(h=>{
      const type=h.getAttribute('data-type');
      const hasVisible = Array.from(itemRows).some(r=>r.getAttribute('data-type')===type && r.style.display!=='none');
      h.style.display = hasVisible ? '' : 'none';
    });
  };
}

// ---------- Manage Types/Sizes/Colors ----------
function renderList(tableId, arr, onSave, inUseFn){
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
      if(inUseFn && inUseFn(val)){
        alert('Cannot delete: still used by one or more products.');
        return;
      }
      if(confirm('Delete this?')){
        arr.splice(idx,1); onSave(arr);
        await store.set(tableId.includes('type')?K_TYPES:tableId.includes('size')?K_SIZES:K_COLORS, arr);
        renderAll(); renderList(tableId,arr,onSave,inUseFn);
      }
    }
    if(e.target.classList.contains('btnEdit')){
      const val=prompt('Rename:', arr[idx]); 
      if(val && val.trim()){
        arr[idx]=val.trim(); onSave(arr);
        await store.set(tableId.includes('type')?K_TYPES:tableId.includes('size')?K_SIZES:K_COLORS, arr);
        renderAll(); renderList(tableId,arr,onSave,inUseFn);
      }
    }
  };
}

function attrInUseType(val){ return P().some(p=>p.type===val); }
function attrInUseSize(val){ return P().some(p=>p.size===val); }
function attrInUseColor(val){ return P().some(p=>p.color===val); }

function renderTypes(){ 
  types = store.get(K_TYPES, types);
  renderList('#typeTable', types, v=>{ types=v; }, attrInUseType); 
}
function renderSizes(){ 
  sizes = store.get(K_SIZES, sizes);
  renderList('#sizeTable', sizes, v=>{ sizes=v; }, attrInUseSize); 
}
function renderColors(){ 
  colors = store.get(K_COLORS, colors);
  renderList('#colorTable', colors, v=>{ colors=v; }, attrInUseColor); 
}

// expose for manage-attributes.html (non-module page calling these)
Object.assign(window, { renderTypes, renderSizes, renderColors });

// ---------- Render & Nav ----------
function renderAll(){
  normalizeProducts();
  renderOverviewTotals();

  if($('#productTable')) renderProducts();
  if($('#invTable')) renderInvestments();
  if($('#salesTable')) renderSales();
  if($('#custTable')) { $('#custMonth') && ($('#custMonth').value = new Date().toISOString().slice(0,7)); renderCustomers(); }
  if($('#expTable')) renderExpenses();

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

document.addEventListener('DOMContentLoaded', ()=>{
  renderAll();
  setupNav();
});
