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
const K_PRODUCTS='pw_products';
const K_INV='pw_investments';
const K_SALES='pw_sales';
const K_EXP='pw_expenses';

// ---------- Seed ----------
function seed(){
  if(!store.get(K_PRODUCTS)){
    store.set(K_PRODUCTS,[
      {size:'8/10+2',  color:'White',        buy1:2.00, sell1:3.00, lowest:2.50},
      {size:'10/14+2', color:'White',        buy1:2.50, sell1:3.50, lowest:2.80},
      {size:'12/16+2', color:'White',        buy1:3.50, sell1:4.50, lowest:3.80},
      {size:'14/18+2', color:'White',        buy1:4.50, sell1:5.50, lowest:4.90},
      {size:'8/10+2',  color:'White (Print)',buy1:2.80, sell1:4.00, lowest:null},
      {size:'10/14+2', color:'White (Print)',buy1:3.00, sell1:4.50, lowest:null},
      {size:'12/16+2', color:'White (Print)',buy1:4.00, sell1:5.50, lowest:null},
    ]);
  }
  if(!store.get(K_INV)) store.set(K_INV,[]);
  if(!store.get(K_SALES)) store.set(K_SALES,[]);
  if(!store.get(K_EXP)) store.set(K_EXP,[]);
}
seed();

// Shortcuts
const P = ()=>store.get(K_PRODUCTS,[]);
const INV = ()=>store.get(K_INV,[]);
const S = ()=>store.get(K_SALES,[]);
const EXP = ()=>store.get(K_EXP,[]);
const prodKey = p => `${p.size} | ${p.color}`;
const allKeys = ()=>P().map(prodKey);
const findProduct = key => {
  const [size,color] = key.split(' | ');
  return P().find(p=>p.size===size && p.color===color);
};

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

  // Totals section
  $('#tInv1') && ($('#tInv1').textContent = TK(inv1));
  $('#tInv2') && ($('#tInv2').textContent = TK(inv2));
  $('#tSell1') && ($('#tSell1').textContent = TK(sell1));
  $('#tSell2') && ($('#tSell2').textContent = TK(sell2));
  $('#tExp')  && ($('#tExp').textContent  = TK(exp));
  $('#tProfit') && ($('#tProfit').textContent = TK(overall));

  // Navbar chip
  if($('#overallProfitChip')){
    const chip = $('#overallProfitChip');
    chip.textContent = overall >= 0 ? `Overall Profit: ${TK(overall)}` : `Overall Loss: ${TK(Math.abs(overall))}`;
    chip.className = 'chip ' + (overall >= 0 ? 'profit' : 'loss');
  }

  // Highlights (only for overview page)
  if($('#overviewHighlights')){
    const customers = new Set(S().map(s=>s.customer)).size;
    $('#highlightCustomers').textContent = customers;

    // Best seller
    const best = {};
    S().forEach(s=>{ best[s.key]=(best[s.key]||0)+s.packs; });
    let top = Object.entries(best).sort((a,b)=>b[1]-a[1])[0];
    $('#highlightBest').textContent = top ? `${top[0]} (${top[1]} packs)` : '—';

    // Low stock (under 3 packs left)
    const low = allKeys().filter(k=>{
      const purchased=INV().filter(r=>r.key===k).reduce((a,b)=>a+b.packs,0);
      const sold=S().filter(r=>r.key===k).reduce((a,b)=>a+b.packs,0);
      return purchased-sold < 3 && purchased > 0;
    });
    $('#highlightLow').textContent = low.length ? low.join(', ') : 'All OK';
  }

  // Charts (only for overview page)
  if($('#chartProfit')) renderCharts();
}


/// ----- Dynamic Size/Color Lists -----
let sizes = ['8/10+2','10/14+2','12/16+2','14/18+2'];
let colors = ['White','White (Print)'];

function renderSizeSelect(selected=''){
  return `<select class="size-select">
    ${sizes.map(s=>`<option ${s===selected?'selected':''}>${s}</option>`).join('')}
    <option value="__new">➕ Add New Size</option>
  </select>`;
}
function renderColorSelect(selected=''){
  return `<select class="color-select">
    ${colors.map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('')}
    <option value="__new">➕ Add New Color</option>
  </select>`;
}

// ----- Products Table -----
function renderProducts(){
  const tb = $('#productTable tbody');
  if(!tb) return;
  tb.innerHTML = P().map((p,i)=>{
    const warn = p.lowest!=null && p.sell1 < p.lowest;
    return `<tr data-idx="${i}">
      <td>${p.size}</td>
      <td>${p.color}</td>
      <td>${p.buy1} TK</td>
      <td>${p.sell1} TK</td>
      <td>${p.lowest? p.lowest+' TK':'—'}</td>
      <td>${warn?'<span class="warn-badge">Below Market</span>':''}</td>
      <td>
        <button class="btn ghost btnEdit">Edit</button>
        <button class="btn danger btnDelete">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

// ----- Add New Row -----
$('#btnAddProduct')?.addEventListener('click', ()=>{
  const tb=$('#productTable tbody');
  const newRow=document.createElement('tr');
  newRow.innerHTML=`
    <td>${renderSizeSelect()}</td>
    <td>${renderColorSelect()}</td>
    <td><input type="number" step="0.01" class="inBuy" placeholder="Buy (1)"/></td>
    <td><input type="number" step="0.01" class="inSell" placeholder="Sell (1)"/></td>
    <td><input type="number" step="0.01" class="inLowest" placeholder="Lowest"/></td>
    <td></td>
    <td><button class="btn primary btnSave">Save</button></td>`;
  tb.appendChild(newRow);
});

// ----- Handle Table Actions -----
$('#productTable')?.addEventListener('click', e=>{
  const tr=e.target.closest('tr'); if(!tr) return;
  const idx=tr.getAttribute('data-idx');
  const items=P();

  // Save new or edited row
  if(e.target.classList.contains('btnSave')){
    const sizeSel=tr.querySelector('.size-select');
    const colorSel=tr.querySelector('.color-select');
    let size=sizeSel.value, color=colorSel.value;
    if(size==='__new'){ size=prompt('Enter new size:'); if(size) sizes.push(size); }
    if(color==='__new'){ color=prompt('Enter new color:'); if(color) colors.push(color); }
    const buy=Number(tr.querySelector('.inBuy').value);
    const sell=Number(tr.querySelector('.inSell').value);
    const lowest=tr.querySelector('.inLowest').value? Number(tr.querySelector('.inLowest').value):null;

    const product={size,color,buy1:buy,sell1:sell,lowest};
    if(idx!=null){ items[idx]=product; } else { items.push(product); }
    store.set(K_PRODUCTS,items);
    renderAll();
  }

  // Edit row
  if(e.target.classList.contains('btnEdit')){
    const p=items[idx];
    tr.innerHTML=`
      <td>${renderSizeSelect(p.size)}</td>
      <td>${renderColorSelect(p.color)}</td>
      <td><input type="number" step="0.01" class="inBuy" value="${p.buy1}"/></td>
      <td><input type="number" step="0.01" class="inSell" value="${p.sell1}"/></td>
      <td><input type="number" step="0.01" class="inLowest" value="${p.lowest??''}"/></td>
      <td></td>
      <td><button class="btn primary btnSave">Save</button></td>`;
  }

  // Delete row
  if(e.target.classList.contains('btnDelete')){
    if(confirm('Are you sure you want to delete this product?')){
      items.splice(idx,1);
      store.set(K_PRODUCTS,items);
      renderAll();
    }
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

  const month = $('#monthFilter').value;
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

  // Recent
  if($('#recentSales')){
    const recent = S().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
    $('#recentSales tbody').innerHTML = recent.map(s=>`
      <tr><td>${s.date}</td><td>${s.customer}</td><td>${s.key}</td>
      <td>${s.packs}</td><td>${TK(s.price100)}</td><td>${TK(s.estProfit)}</td></tr>`).join('');
  }

  // Charts
  if($('#chartProfit')) renderCharts();
}
function drawLine(canvasId, labels, values, title){
  const c=document.getElementById(canvasId); const ctx=c.getContext('2d');
  const W=c.width=c.clientWidth, H=c.height=c.clientHeight, pad=30;
  ctx.clearRect(0,0,W,H);
  const max=Math.max(1,...values); const xstep=(W-pad*2)/Math.max(1,values.length-1);
  const y=v=> H-pad - (v/max)*(H-pad*2);
  ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.beginPath();
  values.forEach((v,i)=>{const X=pad+i*xstep,Y=y(v); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y)}); ctx.stroke();
  ctx.fillStyle="#cbd5e1"; ctx.font="12px sans-serif"; ctx.fillText(title,10,14);
}
function drawBars(canvasId, labels, aVals, bVals, title){
  const c=document.getElementById(canvasId), ctx=c.getContext('2d');
  const W=c.width=c.clientWidth, H=c.height=c.clientHeight, pad=30;
  ctx.clearRect(0,0,W,H);
  const max=Math.max(1,...aVals,...bVals), n=labels.length;
  const bw=(W-pad*2)/n*.8, step=(W-pad*2)/n, y=v=>H-pad-(v/max)*(H-pad*2);
  for(let i=0;i<n;i++){
    const x=pad+i*step; ctx.fillStyle="#93c5fd"; ctx.fillRect(x, y(aVals[i]), bw/2, H-pad - y(aVals[i]));
    ctx.fillStyle="#a7f3d0"; ctx.fillRect(x+bw/2+4, y(bVals[i]), bw/2, H-pad - y(bVals[i]));
  }
  ctx.fillStyle="#cbd5e1"; ctx.font="12px sans-serif"; ctx.fillText(title,10,14);
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
  const sizes = ['8/10+2','10/14+2','12/16+2','14/18+2'];
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
      const cells = sizes.map(sz=> g.sizes[sz]? `${g.sizes[sz]} (x100)` : '0').join('</td><td>');
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
      const obj={size:r.size,color:r.color,buy1:Number(r.buy1),sell1:Number(r.sell1),lowest:r.lowest?Number(r.lowest):null};
      const i=items.findIndex(x=>x.size===obj.size&&x.color===obj.color);
      if(i>-1) items[i]=obj; else items.push(obj);
    }); store.set(K_PRODUCTS,items);
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

// ---------- Render ----------
function renderAll(){
  // Global chip
  renderOverviewTotals();

  // Page-specific pieces (run only if elements exist)
  if($('#productTable')) renderProducts();
  if($('#invTable')) renderInvestments();
  if($('#salesTable')) renderSales();
  if($('#custTable')) { $('#custMonth') && ($('#custMonth').value = new Date().toISOString().slice(0,7)); renderCustomers(); }
  if($('#expTable')) renderExpenses();

  // default date inputs
  $('#sale-date') && ($('#sale-date').value = today());
  $('#inv-date') && ($('#inv-date').value = today());
  $('#exp-date') && ($('#exp-date').value = today());
}
document.addEventListener('DOMContentLoaded', renderAll);
