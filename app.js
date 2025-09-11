// ---------- Helpers ----------
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const today = () => new Date().toISOString().slice(0,10);
const TK = n => `${Number(n||0).toLocaleString('en-US')} TK`;

const store = {
  get(k, d){ try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

// Keys
const K_PRODUCTS   = 'pw_products';
const K_INV        = 'pw_investments';
const K_SALES      = 'pw_sales';
const K_EXP        = 'pw_expenses';
const K_COLLAPSE   = 'pw_collapsed_types';
const K_COLLCOLOR  = 'pw_collapsed_colors';
const K_TYPES      = 'pw_attr_types';
const K_SIZES      = 'pw_attr_sizes';
const K_COLORS     = 'pw_attr_colors';

// ---------- Seed ----------
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

// Shortcuts
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

// ---------- Products Table (grouped, collapsible) ----------
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

  const COLSPAN = 6; // Size, Buy, Sell, Lowest, Status, Actions

  itemsSorted.forEach((p)=>{
    const uKey = uniqueKey(p);

    // New Type header
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

    // New Color subheader
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

// ---------- Add New Product (fields appear AT TOP) ----------
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

// ---------- Handle Products table actions ----------
document.addEventListener('click', (e)=>{
  const table = e.target.closest('#productTable');
  if(!table) return;

  const tr = e.target.closest('tr');

  // Toggle TYPE
  const tBtn = e.target.closest('.btnToggleType');
  if(tBtn){
    const type=tBtn.getAttribute('data-type');
    const set=new Set(collapsedTypes());
    if(set.has(type)) set.delete(type); else set.add(type);
    setCollapsedTypes([...set]);
    renderProducts();
    return;
  }

  // Toggle COLOR
  const cBtn = e.target.closest('.btnToggleColor');
  if(cBtn){
    const type=cBtn.getAttribute('data-type');
    const color=cBtn.getAttribute('data-color');
    const key=`${type}||${color}`;
    const set=new Set(collapsedColors());
    if(set.has(key)) set.delete(key); else set.add(key);
    setCollapsedColors([...set]);
    renderProducts();
    return;
  }

  // Edit
  const editBtn = e.target.closest('.btnEdit');
  if(editBtn){
    const arr = P();
    const uKey = tr.getAttribute('data-key');
    const idx = arr.findIndex(x=> uniqueKey(x)===uKey);
    if(idx < 0) return; // not found (shouldn't happen)
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

  // Delete (by stable key)
  const delBtn = e.target.closest('.btnDelete');
  if(delBtn){
    const arr = P();
    const uKey = tr.getAttribute('data-key');
    const realIdx = arr.findIndex(x=> uniqueKey(x)===uKey);
    if(realIdx>-1 && confirm('Are you sure you want to delete this product?')){
      arr.splice(realIdx,1);
      store.set(K_PRODUCTS,arr);
      renderAll();
    }
    return;
  }

  // Save (new or edit) — validate & de-duplicate
  const saveBtn = e.target.closest('.btnSave');
  if(saveBtn){
    const mode   = tr.getAttribute('data-mode'); // 'new' or 'edit'
    const oldKey = tr.getAttribute('data-key');  // defined in edit mode

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
      if(i<0){ renderAll(); return; } // fallback

      const existsIdx = arr.findIndex(x=> uniqueKey(x)===newKey);
      if(existsIdx>-1 && existsIdx!==i){
        // Merge to existing and remove original slot
        arr[existsIdx] = product;
        arr.splice(i,1);
      }else{
        arr[i] = product;
      }
      store.set(K_PRODUCTS, arr);

    }else{ // new
      const existsIdx = arr.findIndex(x=> uniqueKey(x)===newKey);
      if(existsIdx>-1){
        arr[existsIdx] = product;
      }else{
        arr.push(product);
      }
      store.set(K_PRODUCTS, arr);
    }

    renderAll();
    return;
  }
});

// ---------- Investments & Inventory ----------
function costFor(key,packs){ const p=findProduct(key); return p? p.buy1*100*packs : 0; }
function renderInvestments(){
  const tb = $('#invTable tbody'); if(!tb) return;

  $('#invForm')?.addEventListener('submit', e=>{
    e.preventDefault();
    const key=$('#inv-product').value, packs=Number($('#inv-packs').value);
    const batch=Number($('#inv-batch').value), date=$('#inv-date').value || today();
    const list=INV(); list.push({key,packs,batch,date,cost:costFor(key,packs)});
    store.set(K_INV,list); e.target.reset(); renderAll();
  });

  tb.innerHTML = INV().map((r,i)=>`
    <tr><td>${r.date}</td><td>${r.batch==1?'1st':'2nd'}</td><td>${r.key}</td>
      <td>${r.packs}</td><td>${TK(r.cost)}</td>
      <td><button class="btn danger" data-rm="${i}">Delete</button></td></tr>`).join('');

  tb.addEventListener('click', e=>{
    const idx=e.target.getAttribute('data-rm'); if(idx==null) return;
    const list=INV(); list.splice(Number(idx),1); store.set(K_INV,list); renderAll();
  });

  // Inventory
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

  $('#saleForm')?.addEventListener('submit', e=>{
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
    store.set(K_SALES,list);
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

  $('#salesTable tbody').addEventListener('click', e=>{
    const idx=e.target.getAttribute('data-del'); if(idx==null) return;
    const list=S(); list.splice(Number(idx),1); store.set(K_SALES,list); renderAll();
  });

  if($('#recentSales')){
    const recent = S().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
    $('#recentSales tbody').innerHTML = recent.map(s=>`
      <tr><td>${s.date}</td><td>${s.customer}</td><td>${s.key}</td>
      <td>${s.packs}</td><td>${TK(s.price100)}</td><td>${TK(s.estProfit)}</td></tr>`).join('');
  }

  if($('#chartProfit')) renderCharts();
}
function drawLine(canvasId, labels, values, title){
  const c=document.getElementById(canvasId); const ctx=c.getContext('2d');
  const W=c.width=c.clientWidth, H=c.height=c.clientHeight, pad=30;
  ctx.clearRect(0,0,W,H);
  const max=Math.max(1,...values); const xstep=(W-pad*2)/Math.max(1,values.length-1);
  const y=v=> H-pad - (v/max)*(H-pad*2);
  ctx.beginPath();
  values.forEach((v,i)=>{const X=pad+i*xstep,Y=y(v); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y)}); ctx.stroke();
  ctx.fillText(title,10,14);
}
function drawBars(canvasId, labels, aVals, bVals, title){
  const c=document.getElementById(canvasId), ctx=c.getContext('2d');
  const W=c.width=c.clientWidth, H=c.height=c.clientHeight, pad=30;
  ctx.clearRect(0,0,W,H);
  const max=Math.max(1,...aVals,...bVals), n=labels.length;
  const bw=(W-pad*2)/n*.8, step=(W-pad*2)/n, y=v=>H-pad-(v/max)*(H-pad*2);
  for(let i=0;i<n;i++){
    const x=pad+i*step; ctx.fillRect(x, y(aVals[i]), bw/2, H-pad - y(aVals[i]));
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
  $('#expForm')?.addEventListener('submit', e=>{
    e.preventDefault();
    const type=$('#exp-type').value, desc=$('#exp-desc').value.trim();
    const date=$('#exp-date').value||today(), amount=Number($('#exp-amount').value||0);
    const list=EXP(); list.push({type,desc,date,amount}); store.set(K_EXP,list);
    e.target.reset(); renderAll();
  });
  $('#expAddRange')?.addEventListener('click', ()=>{
    const from=new Date($('#exp-from').value), to=new Date($('#exp-to').value);
    const per=Number($('#exp-perday').value||0); if(!from||!to||!per) return alert('Set From, To and Per day.');
    const list=EXP(); const d=new Date(from);
    while(d<=to){ list.push({type:'Boost',desc:'Daily boost',date:d.toISOString().slice(0,10),amount:per}); d.setDate(d.getDate()+1); }
    store.set(K_EXP,list); renderAll();
  });
  $('#expTable tbody').innerHTML = EXP().sort((a,b)=>b.date.localeCompare(a.date)).map((e,i)=>`
    <tr><td>${e.date}</td><td>${e.type}</td><td>${e.desc||''}</td><td>${TK(e.amount)}</td>
    <td><button class="btn danger" data-x="${i}">Delete</button></td></tr>`).join('');
  $('#expTable tbody').addEventListener('click', e=>{
    const i=e.target.getAttribute('data-x'); if(i==null) return;
    const list=EXP(); list.splice(Number(i),1); store.set(K_EXP,list); renderAll();
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
    if(data.products) store.set(K_PRODUCTS,data.products);
    if(data.investments) store.set(K_INV,data.investments);
    if(data.sales) store.set(K_SALES,data.sales);
    if(data.expenses) store.set(K_EXP,data.expenses);
    renderAll();
  }
});

// CSV Import
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
    store.set(K_PRODUCTS, items);
    normalizeProducts();
  }else if(type==='investments'){
    const inv=INV();
    rows.forEach(r=>{
      const key=`${r.size} | ${r.color}`, packs=Number(r.packs);
      inv.push({date:r.date,batch:Number(r.batch),key,packs,cost:costFor(key,packs)});
    }); store.set(K_INV,inv);
  }else if(type==='sales'){
    const list=S();
    rows.forEach(r=>{
      const key=`${r.size} | ${r.color}`, packs=Number(r.packs), price100=Number(r.price100)||defaultSell100(key);
      list.push({date:r.date,customer:r.customer,key,packs,price100,batch:Number(r.batch),pay:r.pay||'Other',contact:'',estProfit:estProfit(key,packs,price100)});
    }); store.set(K_SALES,list);
  }else if(type==='expenses'){
    const ex=EXP(); rows.forEach(r=>ex.push({date:r.date,type:r.type||'Other',desc:r.description||'',amount:Number(r.amountTK)})); store.set(K_EXP,ex);
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
  tb.onclick = e=>{
    const tr=e.target.closest('tr'); if(!tr) return;
    const idx=Number(tr.dataset.idx);
    if(e.target.classList.contains('btnDelete')){
      const val = arr[idx];
      if(inUseFn && inUseFn(val)){
        alert('Cannot delete: still used by one or more products.');
        return;
      }
      if(confirm('Delete this?')){ arr.splice(idx,1); onSave(arr); renderAll(); renderList(tableId,arr,onSave,inUseFn); }
    }
    if(e.target.classList.contains('btnEdit')){
      const val=prompt('Rename:', arr[idx]); 
      if(val && val.trim()){
        arr[idx]=val.trim(); onSave(arr); renderAll(); renderList(tableId,arr,onSave,inUseFn);
      }
    }
  };
}

function attrInUseType(val){ return P().some(p=>p.type===val); }
function attrInUseSize(val){ return P().some(p=>p.size===val); }
function attrInUseColor(val){ return P().some(p=>p.color===val); }

function renderTypes(){ 
  types = store.get(K_TYPES, types);
  renderList('#typeTable', types, v=>{ types=v; store.set(K_TYPES, v); }, attrInUseType); 
}
function renderSizes(){ 
  sizes = store.get(K_SIZES, sizes);
  renderList('#sizeTable', sizes, v=>{ sizes=v; store.set(K_SIZES, v); }, attrInUseSize); 
}
function renderColors(){ 
  colors = store.get(K_COLORS, colors);
  renderList('#colorTable', colors, v=>{ colors=v; store.set(K_COLORS, v); }, attrInUseColor); 
}

$('#btnAddType')?.addEventListener('click', ()=>{
  const v=$('#newType').value.trim(); if(v){
    const list = store.get(K_TYPES, types);
    if(!list.includes(v)) list.push(v);
    list.sort(); store.set(K_TYPES, list); types=list;
    $('#newType').value=''; renderTypes(); renderAll();
  }
});
$('#btnAddSize')?.addEventListener('click', ()=>{
  const v=$('#newSize').value.trim(); if(v){
    const list = store.get(K_SIZES, sizes);
    if(!list.includes(v)) list.push(v);
    list.sort(); store.set(K_SIZES, list); sizes=list;
    $('#newSize').value=''; renderSizes(); renderAll();
  }
});
$('#btnAddColor')?.addEventListener('click', ()=>{
  const v=$('#newColor').value.trim(); if(v){
    const list = store.get(K_COLORS, colors);
    if(!list.includes(v)) list.push(v);
    list.sort(); store.set(K_COLORS, list); colors=list;
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

  $('#sale-date') && ($('#sale-date').value = today());
  $('#inv-date') && ($('#inv-date').value = today());
  $('#exp-date') && ($('#exp-date').value = today());
}
document.addEventListener('DOMContentLoaded', renderAll);

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
    if(href === page){
      a.classList.add('active');
    }else{
      a.classList.remove('active');
    }
  });
}

// Redirect after login
function doLogin(e){
  e.preventDefault();
  sessionStorage.setItem('pw_authed','1');
  location.href = 'overview.html';
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderAll();
  setupNav();
});