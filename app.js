// app.js (ES module) — Firestore + per-user storage

// ---------- Firebase Init ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Your config
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
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const today = () => new Date().toISOString().slice(0,10);
const TK = n => `${Number(n||0).toLocaleString('en-US')} TK`;

// Current user (by username)
function uid(){ return sessionStorage.getItem('pw_user') || null; }

// SHA-256 helper (used for password hashing)
export async function sha(x){
  const e=new TextEncoder().encode(x);
  const b=await crypto.subtle.digest('SHA-256',e);
  return Array.from(new Uint8Array(b)).map(v=>v.toString(16).padStart(2,'0')).join('');
}

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

// ---------- Cloud-backed store (per user, Firestore) ----------
/*
  Data model (per user):
  /users/{username} {
     username, passwordHash, createdAt
     (subcollection) /kv/{key} { value: <any>, updatedAt }
  }
*/
const store = {
  get(k, d){
    try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
  },
  async set(k, v){
    localStorage.setItem(k, JSON.stringify(v));
    const id = uid();
    if(!id) return; // not logged in, local only
    const ref = doc(db, 'users', id, 'kv', k);
    await setDoc(ref, { value: v, updatedAt: serverTimestamp() }, { merge: true });
  },
  // Keep a local shadow up-to-date
  subscribe(k, defaultVal){
    const id = uid();
    if(!id) return;
    const ref = doc(db, 'users', id, 'kv', k);
    onSnapshot(ref, snap=>{
      if(snap.exists()){
        const v = snap.data().value;
        localStorage.setItem(k, JSON.stringify(v));
      }else if(defaultVal !== undefined){
        localStorage.setItem(k, JSON.stringify(defaultVal));
      }
      // re-render whatever page we are on
      renderAll();
    });
  }
};

// ---------- Users (Signup + Login in Firestore) ----------
export async function addUser(username, password){
  const passHash = await sha(password);
  const userRef = doc(db, 'users', username);
  const exists  = await getDoc(userRef);
  if(exists.exists()){
    throw new Error('username-taken');
  }
  // Create profile doc
  await setDoc(userRef, {
    username,
    passwordHash: passHash,
    createdAt: serverTimestamp()
  });

  // Initialize empty KV docs so first load is smooth
  const initKeys = {
    [K_PRODUCTS]: [],
    [K_INV]: [],
    [K_SALES]: [],
    [K_EXP]: [],
    [K_COLLAPSE]: [],
    [K_COLLCOLOR]: [],
    [K_TYPES]: [],
    [K_SIZES]: [],
    [K_COLORS]: []
  };
  await Promise.all(Object.entries(initKeys).map(([k,v])=>{
    return setDoc(doc(db,'users',username,'kv',k), { value:v, updatedAt: serverTimestamp() });
  }));
}

export async function loginUser(username, password){
  const passHash = await sha(password);
  const userRef = doc(db, 'users', username);
  const snap    = await getDoc(userRef);
  if(!snap.exists()) return false;
  return snap.data().passwordHash === passHash;
}

// ---------- Seed (local defaults so UI isn't empty pre-sync) ----------
function seed(){
  if(!store.get(K_PRODUCTS)) store.set(K_PRODUCTS, []);
  if(!store.get(K_INV)) store.set(K_INV,[]);
  if(!store.get(K_SALES)) store.set(K_SALES,[]);
  if(!store.get(K_EXP)) store.set(K_EXP,[]);
  if(!store.get(K_COLLAPSE)) store.set(K_COLLAPSE,[]);
  if(!store.get(K_COLLCOLOR)) store.set(K_COLLCOLOR,[]);
  if(!store.get(K_TYPES))  store.set(K_TYPES, []);
  if(!store.get(K_SIZES))  store.set(K_SIZES, []);
  if(!store.get(K_COLORS)) store.set(K_COLORS, []);
}
seed();

// Live sync the keys we use on all pages
function startSync(){
  if(!uid()) return;
  [K_PRODUCTS,K_INV,K_SALES,K_EXP,K_COLLAPSE,K_COLLCOLOR,K_TYPES,K_SIZES,K_COLORS].forEach(k=>{
    store.subscribe(k, store.get(k, Array.isArray(store.get(k))?[]:store.get(k)));
  });
}
startSync();

// ---------- Shortcuts ----------
const P   = ()=>store.get(K_PRODUCTS,[]);
const INV = ()=>store.get(K_INV,[]);
const S   = ()=>store.get(K_SALES,[]);
const EXP = ()=>store.get(K_EXP,[]);
const collapsedTypes     = () => store.get(K_COLLAPSE,[]);
const setCollapsedTypes  = v => store.set(K_COLLAPSE, v);
const collapsedColors    = () => store.get(K_COLLCOLOR,[]);
const setCollapsedColors = v => store.set(K_COLLCOLOR, v);

// Attributes
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

  const tBtn = e.target.closest('.btnToggleType');
  if(tBtn){
    const type=tBtn.getAttribute('data-type');
    const setCol=new Set(collapsedTypes());
    if(setCol.has(type)) setCol.delete(type); else setCol.add(type);
    await setCollapsedTypes([...setCol]);
    renderProducts();
    return;
  }

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

  const cancelBtn = e.target.closest('.btnCancel');
  if(cancelBtn){
    renderProducts();
    return;
  }

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

// ---------- Investments, Sales, Charts, Customers, Expenses ----------
function costFor(key,packs){ const p=findProduct(key); return p? p.buy1*100*packs : 0; }
function renderInvestments(){ /* unchanged from your last version, uses store.set(...) */ }
function defaultSell100(key){ const p=findProduct(key); return p? p.sell1*100 : 0; }
function estProfit(key,packs,price100){ const p=findProduct(key); if(!p) return 0; return price100*packs - (p.buy1*100*packs); }
function renderSales(){ /* unchanged from your last version, uses store.set(...) */ }
function drawLine(){ /* unchanged (omitted here for brevity) */ }
function drawBars(){ /* unchanged (omitted here for brevity) */ }
function renderCharts(){ /* unchanged (omitted here for brevity) */ }
function renderCustomers(){ /* unchanged (omitted here for brevity) */ }
function renderExpenses(){ /* unchanged (uses store.set(...)) */ }

// ---------- CSV / Backup (unchanged behavior, now per user via store.set) ----------
function parseCSV(text){ /* unchanged */ }

// ---------- Search / Filter ----------
function attachProductSearch(){ /* unchanged */ }

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
        const key = tableId.includes('type')?K_TYPES:tableId.includes('size')?K_SIZES:K_COLORS;
        await store.set(key, arr);
        renderAll(); renderList(tableId,arr,onSave,inUseFn);
      }
    }
    if(e.target.classList.contains('btnEdit')){
      const val=prompt('Rename:', arr[idx]); 
      if(val && val.trim()){
        arr[idx]=val.trim(); onSave(arr);
        const key = tableId.includes('type')?K_TYPES:tableId.includes('size')?K_SIZES:K_COLORS;
        await store.set(key, arr);
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

$('#btnAddType')?.addEventListener('click', async ()=>{
  const v=$('#newType').value.trim(); if(v){
    const list = store.get(K_TYPES, types);
    if(!list.includes(v)) list.push(v);
    list.sort(); await store.set(K_TYPES, list); types=list;
    $('#newType').value=''; renderTypes(); renderAll();
  }
});
$('#btnAddSize')?.addEventListener('click', async ()=>{
  const v=$('#newSize').value.trim(); if(v){
    const list = store.get(K_SIZES, sizes);
    if(!list.includes(v)) list.push(v);
    list.sort(); await store.set(K_SIZES, list); sizes=list;
    $('#newSize').value=''; renderSizes(); renderAll();
  }
});
$('#btnAddColor')?.addEventListener('click', async ()=>{
  const v=$('#newColor').value.trim(); if(v){
    const list = store.get(K_COLORS, colors);
    if(!list.includes(v)) list.push(v);
    list.sort(); await store.set(K_COLORS, list); colors=list;
    $('#newColor').value=''; renderColors(); renderAll();
  }
});

// ---------- Render ----------
function renderAll(){
  normalizeProducts();
  renderOverviewTotals();

  if($('#productTable')) renderProducts();
  if($('#invTable')) renderInvestments();
  if($('#salesTable')) renderSales();
  if($('#custTable')) { $('#custMonth') && ($('#custMonth').value = new Date().toISOString().slice(0,7)); renderCustomers(); }
  if($('#expTable')) renderExpenses();

  // Manage Attributes page — auto render if tables present
  if($('#typeTable') || $('#sizeTable') || $('#colorTable')){
    renderTypes();
    renderSizes();
    renderColors();
  }

  $('#sale-date') && ($('#sale-date').value = today());
  $('#inv-date') && ($('#inv-date').value = today());
  $('#exp-date') && ($('#exp-date').value = today());
}

// ----- Nav: mobile toggle + active tab -----
function setupNav(){
  const wrap   = document.querySelector('.tabs-wrap');
  const toggle = document.getElementById('navToggle');
  if (toggle && wrap){
    toggle.addEventListener('click', ()=> wrap.classList.toggle('open'));
  }

  const page = (location.pathname.split('/').pop() || 'overview.html').toLowerCase();
  document.querySelectorAll('.tabs a').forEach(a=>{
    const href = (a.getAttribute('href')||'').toLowerCase();
    if(href === page) a.classList.add('active'); else a.classList.remove('active');
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderAll();
  setupNav();
});
