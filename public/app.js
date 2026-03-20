/* ============================================================
   Royal Restaurant — app.js  v5.0
   Full-Page Dashboard | Toggle on 3-dot click
============================================================ */

let managerMode = localStorage.getItem('managerLoggedIn') === 'true'
let cart         = {}
let currency     = '₹'
let taxRate      = 5
let billCounter  = parseInt(localStorage.getItem('billCounter') || '0')
let billsCache   = JSON.parse(localStorage.getItem('billsCache') || '[]')
let pendingImg   = ''
let revenueChart = null, dishChart = null, dailyChart = null

let products = JSON.parse(localStorage.getItem('products')) || [
  {id:1,name:'Full Meals',      price:120,image:''},
  {id:2,name:'Orange Juice',   price:60, image:''},
  {id:3,name:'Coca Cola',      price:40, image:''},
  {id:4,name:'Masala Dosa',    price:80, image:''},
  {id:5,name:'Chicken Biryani',price:180,image:''},
  {id:6,name:'Filter Coffee',  price:30, image:''}
]
function saveProducts(){ localStorage.setItem('products', JSON.stringify(products)) }
function getMgrCreds(){ return { username: localStorage.getItem('mgr_u')||'admin', password: localStorage.getItem('mgr_p')||'123' } }

/* ═══════════ INIT ═══════════ */
window.addEventListener('load', async () => {
  initSupabase()
  setTimeout(() => {
  const loader = document.getElementById('loader')
  if(loader) { loader.style.display = 'none' }
}, 1600)
  loadSavedSettings()
  loadSavedBranding()
const sbSettings = await sbGetAllSettings()
if(sbSettings && sbSettings.branding) applyBrandingData(sbSettings.branding)

  const sbProds = await sbGetProducts()
  if (sbProds && sbProds.length) { products = sbProds; saveProducts() }

  const creds = await sbGetCredentials()
  if (creds) { localStorage.setItem('mgr_u', creds.username); localStorage.setItem('mgr_p', creds.password) }

  const sbBills = await sbGetBills()
  if (sbBills) { billsCache = sbBills; localStorage.setItem('billsCache', JSON.stringify(billsCache)) }

  loadProducts()         // restaurant page products
  updateMenuCountBadge()

   if(managerMode) {
  document.getElementById('sidebarTrigger').style.display='flex'
  document.getElementById('menuAction').innerHTML=`
    <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    Switch to User`
  loadProducts()
}
})

/* ═══════════ DASHBOARD TOGGLE ═══════════ */
function openDashboard(){
  document.getElementById('dashboardPage').style.display   = 'flex'
  document.getElementById('restaurantPage').style.display  = 'none'
  switchDashPage('billing')   // always default to billing
  updateDashStats()
  loadDashProducts()
  syncDashOrders()
}

function closeDashboard(){
  document.getElementById('dashboardPage').style.display  = 'none'
  document.getElementById('restaurantPage').style.display = 'block'
  loadProducts()  // refresh restaurant cards
}

function switchDashPage(name){
  document.querySelectorAll('.dash-page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.dash-nav-btn').forEach(b => b.classList.remove('active'))
  document.getElementById(`dp-${name}`).classList.add('active')
  document.querySelector(`[data-page="${name}"]`).classList.add('active')
  if (name === 'database')  renderDatabase()
  if (name === 'analytics') renderAnalytics()
}

function updateDashStats(){
  document.getElementById('dn-menu').textContent  = products.length
  const qty = Object.values(cart).reduce((a,b)=>a+b.qty,0)
  document.getElementById('dn-cart').textContent  = qty
  const today = new Date().toDateString()
  document.getElementById('dn-today').textContent = billsCache.filter(b=>new Date(b.created_at).toDateString()===today).length
  // nav badge
  const nb = document.getElementById('dashCartBadge')
  if (qty > 0){ nb.textContent = qty; nb.classList.add('show') } else nb.classList.remove('show')
}

/* ═══════════ LOAD PRODUCTS (restaurant page) ═══════════ */
function loadProducts(){
  const container = document.getElementById('products')
  container.innerHTML = ''
  const layout = localStorage.getItem('layout') || 'grid'
  container.className = `products-grid${layout==='compact'?' compact':''}`
  const text = document.getElementById('search').value.toLowerCase()
  const filtered = products.filter(p => p.name.toLowerCase().includes(text))

  if (!filtered.length){
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-3)"><div style="font-size:40px;margin-bottom:12px">🔍</div><p style="font-size:16px;color:var(--text-2)">No items found</p></div>`
    return
  }
  filtered.forEach((p,i) => {
    const div = document.createElement('div')
    div.className = `card${managerMode?' clickable':''}`
    div.style.animationDelay = `${i*.06}s`
    div.innerHTML = cardHTML(p, managerMode)
    if (managerMode) div.onclick = () => addToOrder(p)
    container.appendChild(div)
  })
  updateMenuCountBadge()
}

/* ═══════════ LOAD PRODUCTS (dashboard billing) ═══════════ */
function loadDashProducts(filter=''){
  const container = document.getElementById('dashProducts')
  container.innerHTML = ''
  container.className = 'dash-products-grid'
  const filtered = products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))

  filtered.forEach((p,i) => {
    const div = document.createElement('div')
    div.className = 'card clickable'
    div.style.animationDelay = `${i*.04}s`
    div.innerHTML = cardHTML(p, true)
    div.onclick = () => { addToOrder(p); updateDashStats() }
    container.appendChild(div)
  })

  // Add item button card
  const add = document.createElement('div')
  add.className = 'card addCard clickable'
  add.innerHTML = `<div class="add-icon">+</div><p>Add Menu Item</p>`
  add.onclick = () => openModal('addModal')
  container.appendChild(add)
}

function dashSearchProducts(val){
  loadDashProducts(val)
}

function cardHTML(p, clickable){
  return `
    <div class="card-img-wrap">
      ${p.image?`<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`:'' }
      <div class="card-img-fallback" ${p.image?'style="display:none"':''}>${p.name.charAt(0)}</div>
      ${clickable?`
      <button class="card-delete" onclick="deleteProduct(event,${p.id||0})" title="Remove">✕</button>
      <button class="card-edit"   onclick="editProduct(event,${p.id||0})"   title="Edit">✎</button>
    `:''}
    </div>
    <div class="card-body">
      <h3>${p.name}</h3>
      <p class="price"><span class="price-symbol">${currency}</span>${Number(p.price).toLocaleString('en-IN')}</p>
      ${clickable?`<div class="card-add-hint">Tap to add</div>`:''}
    </div>`
}

/* ═══════════ SEARCH (restaurant page) ═══════════ */
document.getElementById('search').addEventListener('input', e => {
  document.getElementById('searchClear').classList.toggle('show', e.target.value.length>0)
  loadProducts()
})
document.getElementById('searchClear').onclick = () => {
  document.getElementById('search').value=''
  document.getElementById('searchClear').classList.remove('show')
  loadProducts()
}

/* ═══════════ MODAL HELPERS ═══════════ */
function openModal(id){ const el=document.getElementById(id); el.style.display='flex'; setTimeout(()=>el.classList.add('open'),10) }
function closeModal(id){ const el=document.getElementById(id); el.classList.remove('open'); setTimeout(()=>el.style.display='none',300) }

/* ═══════════ LOGIN / LOGOUT ═══════════ */
function managerToggle(){
  if (!managerMode){ openModal('loginModal') }
  else {
    managerMode=false;
     localStorage.removeItem('managerLoggedIn')
        cart={}
    document.getElementById('orderPanel') && (document.getElementById('orderPanel').style.display='none')
    document.getElementById('sidebarTrigger').style.display='none'
    document.getElementById('menuAction').innerHTML=`
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      Manager Login`
    document.getElementById('cartBadge').style.display='none'
    loadProducts(); updateMenuCountBadge()
    showToast('Logged out','')
  }
  closeDropdown()
}

async function login(){
  const u=document.getElementById('username').value.trim()
  const p=document.getElementById('password').value
  const creds=getMgrCreds()
  const errEl=document.getElementById('loginError')
  if(u===creds.username && p===creds.password){
    managerMode=true
     localStorage.setItem('managerLoggedIn', 'true')
    closeModal('loginModal')
    document.getElementById('sidebarTrigger').style.display='flex'
    document.getElementById('menuAction').innerHTML=`
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Switch to User`
    errEl.style.display='none'
    document.getElementById('username').value=''
    document.getElementById('password').value=''
    loadProducts(); updateMenuCountBadge()
    // Load manager settings from Supabase
    const settings = await sbGetAllSettings()
    if(settings){
      if(settings.branding) applyBrandingData(settings.branding)
      if(settings.taxRate)  { taxRate=parseInt(settings.taxRate); updateTaxLabel(taxRate) }
      if(settings.currency) setCurrencyVal(settings.currency)
      if(settings.managerTheme) setTheme(settings.managerTheme, false)
    }
    // Pre-fill credentials fields
    const c=getMgrCreds()
    const mu=document.getElementById('mgr-username'); if(mu) mu.value=c.username
    showToast('Welcome back, Manager! 👋','success')
  } else {
    errEl.style.display='block'
  }
}
function closeLogin(){ closeModal('loginModal'); document.getElementById('loginError').style.display='none' }

/* ═══════════ ADD / DELETE PRODUCT ═══════════ */
function previewImage(event){
  const file = event.target.files[0]; if(!file) return
  /* Show local preview immediately */
  const reader = new FileReader()
  reader.onload = e => {
    document.getElementById('imgPreview').src = e.target.result
    document.getElementById('imgPreview').style.display = 'block'
    document.getElementById('imgUploadPlaceholder').style.display = 'none'
  }
  reader.readAsDataURL(file)
  /* Store the file for Cloudinary upload */
  window._pendingFile = file
}

async function addProduct(){
  const name  = document.getElementById('foodName').value.trim()
  const price = parseFloat(document.getElementById('foodPrice').value)
  if(!name||!price){ showToast('Fill name and price','error'); return }

  /* Upload image to Cloudinary if file selected */
  let imageUrl = ''
  const addBtn = document.querySelector('#addModal .btn-primary')
  if(window._pendingFile){
    try{
      addBtn.textContent = 'Uploading…'; addBtn.disabled = true
      imageUrl = await uploadToCloudinary(window._pendingFile)
    } catch(e){
      showToast('Image upload failed','error')
      addBtn.textContent = 'Add Item'; addBtn.disabled = false
      return
    }
  }
  addBtn.textContent = 'Add Item'; addBtn.disabled = false

  const newProd = { id:Date.now(), name, price, image:imageUrl }
  products.push(newProd); saveProducts()
  const sbProd = await sbAddProduct(newProd)
  if(sbProd){ newProd.id = sbProd.id; saveProducts() }

  closeModal('addModal')
  document.getElementById('foodName').value  = ''
  document.getElementById('foodPrice').value = ''
  document.getElementById('foodImageFile').value = ''
  document.getElementById('imgPreview').style.display = 'none'
  document.getElementById('imgUploadPlaceholder').style.display = 'flex'
  window._pendingFile = null
  loadProducts(); loadDashProducts()
  updateMenuCountBadge(); updateDashStats()
  showToast(`"${name}" added ✓`,'success')
}
function closeAdd(){
  closeModal('addModal')
  document.getElementById('foodImageFile').value=''
  document.getElementById('imgPreview').style.display='none'
  document.getElementById('imgUploadPlaceholder').style.display='flex'
  window._pendingFile = null
  document.getElementById('foodName').value=''
  document.getElementById('foodPrice').value=''
}

async function deleteProduct(e,id){
  e.stopPropagation()
  if(document.getElementById('pref-confirm')?.checked && !confirm('Remove this item?')) return
  products=products.filter(p=>(p.id||0)!=id); saveProducts()
  await sbDeleteProduct(id)
  loadProducts(); loadDashProducts()
  updateMenuCountBadge(); updateDashStats()
  showToast('Item removed','')
}

/* ── EDIT PRODUCT ── */
function editProduct(e, id){
  e.stopPropagation()
  const p = products.find(p => (p.id||0) == id)
  if(!p) return
  window._editingProductId = id
  document.getElementById('editFoodName').value  = p.name
  document.getElementById('editFoodPrice').value = p.price
  document.getElementById('editImgPreview').src  = p.image || ''
  document.getElementById('editImgPreview').style.display   = p.image ? 'block' : 'none'
  document.getElementById('editImgPlaceholder').style.display = p.image ? 'none' : 'flex'
  window._editPendingFile = null
  openModal('editModal')
}

function editPreviewImage(event){
  const file = event.target.files[0]; if(!file) return
  const reader = new FileReader()
  reader.onload = e => {
    document.getElementById('editImgPreview').src = e.target.result
    document.getElementById('editImgPreview').style.display = 'block'
    document.getElementById('editImgPlaceholder').style.display = 'none'
  }
  reader.readAsDataURL(file)
  window._editPendingFile = file
}

async function saveEditProduct(){
  const id    = window._editingProductId
  const name  = document.getElementById('editFoodName').value.trim()
  const price = parseFloat(document.getElementById('editFoodPrice').value)
  if(!name||!price){ showToast('Fill name and price','error'); return }

  const saveBtn = document.querySelector('#editModal .btn-primary')
  let imageUrl  = products.find(p=>(p.id||0)==id)?.image || ''

  if(window._editPendingFile){
    try{
      saveBtn.textContent = 'Uploading…'; saveBtn.disabled = true
      imageUrl = await uploadToCloudinary(window._editPendingFile)
    } catch(e){
      showToast('Image upload failed','error')
      saveBtn.textContent = 'Save Changes'; saveBtn.disabled = false
      return
    }
  }
  saveBtn.textContent = 'Save Changes'; saveBtn.disabled = false

  /* Update local */
  const idx = products.findIndex(p=>(p.id||0)==id)
  if(idx !== -1){ products[idx] = {...products[idx], name, price, image:imageUrl} }
  saveProducts()
  /* Update Supabase */
  await sbUpdateProduct(id, { name, price, image:imageUrl })

  closeModal('editModal')
  window._editPendingFile = null
  loadProducts(); loadDashProducts()
  showToast(`"${name}" updated ✓`,'success')
}

function closeEdit(){
  closeModal('editModal')
  window._editPendingFile = null
}

/* ═══════════ CART ═══════════ */
function addToOrder(p){
  if(!cart[p.name]) cart[p.name]={qty:0,price:p.price}
  cart[p.name].qty++
  updateOrders()
  showToast(`+1  ${p.name}`,'success')
}

function updateOrders(){
  // Update both dashboard and any other order displays
  syncDashOrders()
  updateCartBadge()
}

function syncDashOrders(){
  const el=document.getElementById('dashOrders')
  if(!el) return
  el.innerHTML=''
  const entries=Object.entries(cart)
  if(!entries.length){
    el.innerHTML=`<div class="bop-empty"><div style="font-size:32px;opacity:.3">🍽</div><p>No items yet</p><span>Click a dish to add</span></div>`
    updateBopTotals(0); return
  }
  let subtotal=0
  entries.forEach(([item,data])=>{
    const price=data.qty*data.price; subtotal+=price
    const div=document.createElement('div'); div.className='order-item-row'
    div.innerHTML=`
      <div class="order-item-info">
        <div class="order-item-name">${item}</div>
        <div class="order-item-detail">${currency}${data.price.toLocaleString('en-IN')} × ${data.qty}</div>
      </div>
      <span class="order-item-price">${currency}${price.toLocaleString('en-IN')}</span>
      <button class="deleteBtn" onclick="deleteItem('${item}')">✕</button>`
    el.appendChild(div)
  })
  updateBopTotals(subtotal)
}

function updateBopTotals(subtotal){
  const tax=Math.round(subtotal*(taxRate/100))
  const total=subtotal+tax
  const s=document.getElementById('dSubtotal'); if(s) s.textContent=subtotal.toLocaleString('en-IN')
  const t=document.getElementById('dTaxAmt');   if(t) t.textContent=tax.toLocaleString('en-IN')
  const g=document.getElementById('dTotal');    if(g) g.textContent=total.toLocaleString('en-IN')
  const tl=document.getElementById('dTaxLabel'); if(tl) tl.textContent=taxRate
  document.querySelectorAll('.cur').forEach(el=>el.textContent=currency)
}

function deleteItem(name){ delete cart[name]; updateOrders() }

function clearCart(){ cart={}; updateOrders(); updateDashStats(); showToast('Order cleared','') }

function updateCartBadge(){
  const badge=document.getElementById('cartBadge')
  const qty=Object.values(cart).reduce((a,b)=>a+b.qty,0)
  document.getElementById('cartCount').textContent=qty
  badge.style.display=(managerMode && qty>0)?'flex':'none'
  updateDashStats()
}

function updateMenuCountBadge(){
  document.getElementById('menuItemCount').textContent=products.length
  const ub=document.getElementById('userMenuBadge')
  ub.style.display=(!managerMode)?'flex':'none'
}

/* ═══════════ RECEIPT ═══════════ */
function showReceipt(){
  const entries=Object.entries(cart)
  if(!entries.length){ showToast('Add items first','error'); return }
  billCounter++; localStorage.setItem('billCounter',billCounter)
  const billItemsEl=document.getElementById('billItems')
  billItemsEl.innerHTML=''
  let subtotal=0
  entries.forEach(([item,data])=>{
    const amount=data.qty*data.price; subtotal+=amount
    const row=document.createElement('div'); row.className='bill-item-row'
    row.innerHTML=`<span>${item}</span><span>${data.qty}</span><span>${currency}${data.price.toLocaleString('en-IN')}</span><span>${currency}${amount.toLocaleString('en-IN')}</span>`
    billItemsEl.appendChild(row)
  })
  const tax=Math.round(subtotal*(taxRate/100)); const total=subtotal+tax
  const now=new Date()
  document.getElementById('billNo').textContent=`#${String(billCounter).padStart(4,'0')}`
  document.getElementById('billSubtotal').textContent=`${currency}${subtotal.toLocaleString('en-IN')}`
  document.getElementById('billTax').textContent=`${currency}${tax.toLocaleString('en-IN')}`
  document.getElementById('billTotal').textContent=`${currency}${total.toLocaleString('en-IN')}`
  document.getElementById('billTaxLabel').textContent=taxRate
  document.getElementById('billTime').textContent=now.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
  openModal('receiptModal')
setTimeout(() => document.getElementById('printBillBtn').focus(), 350)
}
function closeReceipt(){ closeModal('receiptModal') }

async function printBillAsImage(){
  showToast('Generating bill…','')
  try{
    const canvas = await html2canvas(document.getElementById('billCapture'),{backgroundColor:'#f8f4ec',scale:2,useCORS:true,logging:false})
    const dataUrl = canvas.toDataURL('image/png')
    
    // Download automatically
    const link = document.createElement('a')
    link.download = `bill-${document.getElementById('billNo').textContent}.png`
    link.href = dataUrl
    link.click()
    
    // Print
    const printDiv = document.createElement('div')
    printDiv.id = 'printArea'
    printDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;z-index:99999;background:white;display:flex;align-items:center;justify-content:center;overflow:auto'
    printDiv.innerHTML = `<img src="${dataUrl}" style="max-width:90vw;max-height:90vh;width:auto;height:auto;display:block;margin:auto">`
    document.body.appendChild(printDiv)
      setTimeout(() => {
      window.print()
      setTimeout(() => document.body.removeChild(printDiv), 500)
      }, 500)
    
  } catch(err){
    showToast('Failed','error')
  }
}

function buildBillRecord(){
  let subtotal=0
  const items=Object.entries(cart).map(([name,data])=>{ const amount=data.qty*data.price; subtotal+=amount; return{name,qty:data.qty,rate:data.price,amount} })
  const tax=Math.round(subtotal*(taxRate/100)); const total=subtotal+tax
  return{bill_no:document.getElementById('billNo').textContent,items,subtotal,tax,total,currency,created_at:new Date().toISOString()}
}

async function saveBillRecord(bill){
  const sbRecord=await sbSaveBill(bill)
  if(sbRecord) bill={...bill,id:sbRecord.id,created_at:sbRecord.created_at}
  billsCache.unshift(bill)
  localStorage.setItem('billsCache',JSON.stringify(billsCache))
  // update month pill
  const today=new Date(); const thisKey=getMonthKey(today)
  const thisTotal=billsCache.filter(b=>getMonthKey(new Date(b.created_at))===thisKey).reduce((s,b)=>s+Number(b.total),0)
  const pill=document.getElementById('dbMonthTotal'); if(pill) pill.textContent=`This month: ${currency}${thisTotal.toLocaleString('en-IN')}`
}

function downloadBillImage(){
  const img=document.getElementById('billImage').src; if(!img) return
  const now=new Date(); const bn=document.getElementById('billNo').textContent.replace('#','')
  const a=document.createElement('a'); a.href=img; a.download=`Royal_Restaurant_Bill_${bn}_${now.getDate()}-${now.getMonth()+1}-${now.getFullYear()}.png`; a.click()
  showToast('Downloaded ✓','success')
}
function closeBillImage(){ closeModal('billImageModal') }

/* ═══════════ DATABASE ═══════════ */
function renderDatabase(){
  const container=document.getElementById('dbContainer')
  if(!billsCache.length){
    container.innerHTML=`<div class="db-empty"><svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="opacity:.3;margin:0 auto 12px;display:block"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg><p>No bills yet</p><span>Bills appear here after printing</span></div>`
    return
  }
  const groups=groupBillsByMonth(billsCache)
  container.innerHTML=''
  const thisKey=getMonthKey(new Date())
  const thisGrp=groups.find(([k])=>k===thisKey)
  const thisTot=thisGrp?thisGrp[1].total:0
  const pill=document.getElementById('dbMonthTotal'); if(pill) pill.textContent=`This month: ${currency}${thisTot.toLocaleString('en-IN')}`
  groups.forEach(([,grp])=>{
    const div=document.createElement('div'); div.className='db-month-group'
    div.innerHTML=`
      <div class="db-month-header">
        <span class="db-month-name">${grp.label}</span>
        <span style="font-size:12px;color:var(--text-3)">${grp.bills.length} bill${grp.bills.length!==1?'s':''}</span>
      </div>
      <table class="db-table">
        <thead><tr><th>S.No</th><th>Orders</th><th>Total</th><th style="text-align:right">Time</th></tr></thead>
        <tbody>${grp.bills.map((b,i)=>{
          const items=Array.isArray(b.items)?b.items.map(it=>`${it.name} ×${it.qty}`).join(', '):Object.entries(b.items||{}).map(([n,d])=>`${n} ×${d.qty||1}`).join(', ')
          const t=new Date(b.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})
          return`<tr><td>${i+1}</td><td class="orders-cell">${items}</td><td class="total-cell">${b.currency||currency}${Number(b.total).toLocaleString('en-IN')}</td><td class="time-cell">${t}</td></tr>`
        }).join('')}</tbody>
      </table>
      <div class="db-month-footer"><span>Month Total (${grp.bills.length} bills)</span><strong>${currency}${grp.total.toLocaleString('en-IN')}</strong></div>`
    container.appendChild(div)
  })
}

function groupBillsByMonth(bills){
  const groups={}
  bills.forEach(b=>{
    const d=new Date(b.created_at); const key=getMonthKey(d); const lbl=d.toLocaleDateString('en-IN',{month:'long',year:'numeric'})
    if(!groups[key]) groups[key]={label:lbl,bills:[],total:0}
    groups[key].bills.push(b); groups[key].total+=Number(b.total)
  })
  return Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0]))
}
function getMonthKey(d){ return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }

/* ═══════════ ANALYTICS ═══════════ */
function renderAnalytics(){
  if(revenueChart){ revenueChart.destroy(); revenueChart=null }
  if(dishChart){ dishChart.destroy(); dishChart=null }
  if(dailyChart){ dailyChart.destroy(); dailyChart=null }
  const bills=billsCache
  const months=getLast6Months()
  const revData=months.map(m=>bills.filter(b=>getMonthKey(new Date(b.created_at))===m.key).reduce((s,b)=>s+Number(b.total),0))
  revenueChart=new Chart(document.getElementById('revenueChart').getContext('2d'),{type:'bar',data:{labels:months.map(m=>m.short),datasets:[{label:'Revenue',data:revData,backgroundColor:'rgba(201,168,76,.7)',borderColor:'#c9a84c',borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${currency}${ctx.raw.toLocaleString('en-IN')}`}}},scales:{x:{ticks:{font:{size:10},color:'#756855'},grid:{display:false}},y:{ticks:{font:{size:10},color:'#756855',callback:v=>`${currency}${v}`},grid:{color:'rgba(201,168,76,.08)'}}}}})
  const dishCount={}
  bills.forEach(b=>{ const items=Array.isArray(b.items)?b.items:[]; items.forEach(it=>{ dishCount[it.name]=(dishCount[it.name]||0)+(it.qty||1) }) })
  const topDishes=Object.entries(dishCount).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const COLORS=['#c9a84c','#e8c56a','#8a6e2e','#5ec4d8','#e8956d']
  dishChart=new Chart(document.getElementById('dishChart').getContext('2d'),{type:'doughnut',data:{labels:topDishes.map(([n])=>n),datasets:[{data:topDishes.map(([,v])=>v),backgroundColor:COLORS,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:10},color:'#b8a98a',boxWidth:10,padding:10}},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw} sold`}}}}})
  const thisKey=getMonthKey(new Date()); const dn=new Date().getDate(); const dayLabels=Array.from({length:dn},(_,i)=>i+1)
  const dayData=dayLabels.map(d=>bills.filter(b=>{ const bd=new Date(b.created_at); return getMonthKey(bd)===thisKey&&bd.getDate()===d }).length)
  dailyChart=new Chart(document.getElementById('dailyChart').getContext('2d'),{type:'line',data:{labels:dayLabels,datasets:[{label:'Bills',data:dayData,borderColor:'#c9a84c',backgroundColor:'rgba(201,168,76,.1)',fill:true,tension:.4,pointRadius:2,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:9},color:'#756855',maxTicksLimit:10},grid:{display:false}},y:{ticks:{font:{size:9},color:'#756855',stepSize:1},grid:{color:'rgba(201,168,76,.08)'}}}}})
}
function getLast6Months(){ const months=[]; const d=new Date(); for(let i=5;i>=0;i--){ const m=new Date(d.getFullYear(),d.getMonth()-i,1); months.push({key:getMonthKey(m),short:m.toLocaleDateString('en-IN',{month:'short'})}) } return months }

/* ═══════════ BRANDING ═══════════ */
const defaultBranding={line1:'Royal',line2:'Restaurant',tagline:'Fine Dining Experience',heroLabel:'Welcome to',heroSub:'Taste the tradition. Feel the luxury.',menuSub:'Fresh ingredients, timeless recipes',address:'123 Palace Road, Chennai — 600001',phone:'+91 98765 43210',thanks:'Thank you for dining with us!'}

function applyBranding(){
  const b = getBrandingInputValues()
  applyBrandingData(b)
  /* Save the computed name immediately so OTP email always has latest name */
  const l1 = (b.line1||'').trim(), l2 = (b.line2||'').trim()
  const name = l1&&l2 ? l1+' '+l2 : (l1||l2||'')
  if (name) localStorage.setItem('restName', name)
}

function applyBrandingData(b){
  const l1=(b.line1||'').trim(); const l2=(b.line2||'').trim()
  const l1El=document.getElementById('heroLine1'); const l2El=document.getElementById('heroLine2')
  const brEl=document.getElementById('heroTitleBr'); const titleEl=document.getElementById('heroTitle')
  if(l1&&l2){ l1El.textContent=l1;l1El.style.display='';brEl.style.display='';l2El.textContent=l2;l2El.style.display='';titleEl.classList.remove('one-line') }
  else if(l1){ l1El.textContent=l1;l1El.style.display='';brEl.style.display='none';l2El.style.display='none';titleEl.classList.add('one-line') }
  else if(l2){ l1El.style.display='none';brEl.style.display='none';l2El.textContent=l2;l2El.style.display='';titleEl.classList.add('one-line') }
  else{ l1El.textContent='Royal';l1El.style.display='';brEl.style.display='';l2El.textContent='Restaurant';l2El.style.display='';titleEl.classList.remove('one-line') }
  const name=(l1&&l2)?`${l1} ${l2}`:(l1||l2||'Royal Restaurant')
  document.getElementById('headerBrandName').textContent=name
  localStorage.setItem('restName', name)
  document.getElementById('headerTagline').textContent=b.tagline||defaultBranding.tagline
  document.getElementById('heroLabel').textContent=b.heroLabel||defaultBranding.heroLabel
  document.getElementById('heroSub').textContent=b.heroSub||defaultBranding.heroSub
  document.getElementById('menuSubtitle').textContent=b.menuSub||defaultBranding.menuSub
  document.getElementById('footerBrand').textContent=`✦ ${name}`
  document.getElementById('footerCopy').textContent=`© ${new Date().getFullYear()} ${name}. All rights reserved.`
  document.title=name
  document.getElementById('billRestName').textContent=name
  document.getElementById('billAddress').textContent=b.address||defaultBranding.address
  document.getElementById('billPhone').textContent=`📞 ${b.phone||defaultBranding.phone}`
  document.getElementById('billThanks').textContent=b.thanks||defaultBranding.thanks
  const fields={line1:'br-line1',line2:'br-line2',tagline:'br-tagline',heroLabel:'br-hero-label',heroSub:'br-hero-sub',menuSub:'br-menu-sub',address:'br-address',phone:'br-phone',thanks:'br-thanks'}
  Object.entries(fields).forEach(([k,id])=>{ const el=document.getElementById(id); if(el&&b[k]&&el.value!==b[k]) el.value=b[k] })
}

function getBrandingInputValues(){ return{line1:document.getElementById('br-line1')?.value.trim(),line2:document.getElementById('br-line2')?.value.trim(),tagline:document.getElementById('br-tagline')?.value.trim(),heroLabel:document.getElementById('br-hero-label')?.value.trim(),heroSub:document.getElementById('br-hero-sub')?.value.trim(),menuSub:document.getElementById('br-menu-sub')?.value.trim(),address:document.getElementById('br-address')?.value.trim(),phone:document.getElementById('br-phone')?.value.trim(),thanks:document.getElementById('br-thanks')?.value.trim()} }

async function saveBranding(){ const b=getBrandingInputValues(); localStorage.setItem('branding',JSON.stringify(b)); applyBrandingData(b); await sbSaveSetting('branding',b); showToast('Branding saved ✓','success') }
function loadSavedBranding(){
  const saved=JSON.parse(localStorage.getItem('branding')||'{}')
  if(Object.keys(saved).length) applyBrandingData(saved)
  // Load saved manager email into branding field
  const emailEl=document.getElementById('br-email')
  if(emailEl) emailEl.value=localStorage.getItem('mgr_email')||'naveenadhithya123@gmail.com'
}
async function resetBranding(){ Object.entries({line1:'br-line1',line2:'br-line2',tagline:'br-tagline',heroLabel:'br-hero-label',heroSub:'br-hero-sub',menuSub:'br-menu-sub',address:'br-address',phone:'br-phone',thanks:'br-thanks'}).forEach(([k,id])=>{ const el=document.getElementById(id); if(el) el.value=defaultBranding[k]||'' }); localStorage.removeItem('branding'); applyBrandingData(defaultBranding); await sbSaveSetting('branding',defaultBranding); showToast('Branding reset','') }

/* ═══════════ SETTINGS ═══════════ */
function setTheme(t,persist=true){
  document.documentElement.setAttribute('data-theme',t)
  document.querySelectorAll('[id^="tile-"],[id^="utile-"]').forEach(el=>el.classList.remove('active'))
  const mt=document.getElementById(`tile-${t}`); if(mt) mt.classList.add('active')
  const ut=document.getElementById(`utile-${t}`); if(ut) ut.classList.add('active')
  if(!persist) return
  localStorage.setItem('theme',t)
  if(managerMode) sbSaveSetting('managerTheme',t)
}
function setUserTheme(t){ setTheme(t); showToast(`Theme: ${t}`,'success') }
function setLayout(l){
  document.getElementById('btnGrid').classList.toggle('active',l==='grid')
  document.getElementById('btnCompact').classList.toggle('active',l==='compact')
  localStorage.setItem('layout',l); loadProducts()
}
function updateTaxLabel(v){ taxRate=parseInt(v); document.getElementById('taxRateVal').textContent=`${v}%`; syncDashOrders() }
function setCurrency(sym,btn){ setCurrencyVal(sym); document.querySelectorAll('.currency-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active') }
function setCurrencyVal(sym){ currency=sym; loadProducts(); loadDashProducts(); syncDashOrders(); localStorage.setItem('currency',sym); document.querySelectorAll('.currency-btn').forEach(b=>b.classList.toggle('active',b.textContent.trim().startsWith(sym))) }

async function saveSettings(){
  localStorage.setItem('taxRate',taxRate); localStorage.setItem('currency',currency)
  localStorage.setItem('autoclear',document.getElementById('pref-autoclear').checked)
  localStorage.setItem('showbadge',document.getElementById('pref-badge').checked)
  localStorage.setItem('confirmDel',document.getElementById('pref-confirm').checked)
  if(managerMode){ await sbSaveSetting('taxRate',taxRate); await sbSaveSetting('currency',currency) }
  showToast('Settings saved ✓','success')
}

function loadSavedSettings(){
  const t=localStorage.getItem('theme')||'dark'; setTheme(t,false)
  const l=localStorage.getItem('layout')||'grid'; setLayout(l)
  const st=parseInt(localStorage.getItem('taxRate')||'5'); taxRate=st
  const taxEl=document.getElementById('taxRate'); if(taxEl){ taxEl.value=st; document.getElementById('taxRateVal').textContent=`${st}%` }
  const sc=localStorage.getItem('currency')||'₹'; setCurrencyVal(sc)
  const ac=localStorage.getItem('autoclear'),sb=localStorage.getItem('showbadge'),cd=localStorage.getItem('confirmDel')
  if(ac!==null) document.getElementById('pref-autoclear').checked=ac==='true'
  if(sb!==null) document.getElementById('pref-badge').checked=sb==='true'
  if(cd!==null) document.getElementById('pref-confirm').checked=cd==='true'
}

async function saveCredentials(){
  const u=document.getElementById('mgr-username').value.trim()
  const p=document.getElementById('mgr-password').value
  if(!u||!p){ showToast('Fill both fields','error'); return }
  localStorage.setItem('mgr_u',u); localStorage.setItem('mgr_p',p)
  const ok=await sbUpdateCredentials(u,p)
  document.getElementById('mgr-password').value=''
  showToast(ok?'Credentials updated ✓':'Saved locally','success')
}

function openUserSettings(){
  const t=localStorage.getItem('theme')||'dark'
  document.querySelectorAll('[id^="utile-"]').forEach(el=>el.classList.remove('active'))
  const el=document.getElementById(`utile-${t}`); if(el) el.classList.add('active')
  openModal('userSettingsModal')
}

/* ═══════════ DROPDOWN ═══════════ */
const menuBtn=document.getElementById('menuBtn'), dropdown=document.getElementById('dropdown')
menuBtn.onclick=e=>{ e.stopPropagation(); const open=dropdown.classList.contains('open'); menuBtn.classList.toggle('open',!open); dropdown.classList.toggle('open',!open) }
document.getElementById('menuAction').onclick=managerToggle
document.addEventListener('click',closeDropdown)
function closeDropdown(){ dropdown.classList.remove('open'); menuBtn.classList.remove('open') }

/* ═══════════ TOAST ═══════════ */
let toastTimer
function showToast(msg,type=''){ const t=document.getElementById('toast'); t.textContent=msg; t.className=`toast ${type} show`; clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2800) }

/* ═══════════ KEYBOARD ═══════════ */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    closeModal('loginModal'); closeModal('addModal'); closeModal('receiptModal')
    closeModal('billImageModal'); closeModal('userSettingsModal')
    closeDropdown()
    if(document.getElementById('dashboardPage').style.display!=='none') closeDashboard()
  }
    if(e.key==='Enter'){
    const receipt = document.getElementById('receiptModal')
    const billImg = document.getElementById('billImageModal')
    const dashPage = document.getElementById('dashboardPage')
    
    if(dashPage && dashPage.style.display!=='none' && 
       receipt && !receipt.classList.contains('open')){
      showReceipt()
      return
    }
    
    if(receipt && receipt.classList.contains('open')){
      printBillAsImage()
    } else if(billImg && billImg.classList.contains('open')){
      printBillAsImage()
    }
  }
})

/* ═══════════════════════════════════════════════
   FORGOT PASSWORD / OTP FLOW
   Uses backend: POST /send-otp  /verify-otp  /reset-password
   Falls back to localStorage if backend not running
════════════════════════════════════════════════ */

/* Auto-detect backend URL — works locally AND on Render */
const BACKEND = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : window.location.origin
let otpTargetEmail = ''

/* ── Open forgot password modal ── */
/* ── Helper: mask email e.g. nav***123@gmail.com ── */
function maskEmail(email) {
  const [local, domain] = email.split('@')
  if (!domain) return email
  if (local.length <= 4) return local[0] + '***@' + domain
  return local.slice(0,3) + '***' + local.slice(-3) + '@' + domain
}

/* ── Get restaurant name from branding ── */
function getRestaurantName() {
  /* Read ALL possible sources and return the best one */

  /* Source 1: dedicated restName key (set on every page load via applyBrandingData) */
  const rn = localStorage.getItem('restName')
  if (rn && rn.trim()) return rn.trim()

  /* Source 2: branding object in localStorage */
  try {
    const b  = JSON.parse(localStorage.getItem('branding') || '{}')
    const l1 = (b.line1 || '').trim()
    const l2 = (b.line2 || '').trim()
    if (l1 && l2) return l1 + ' ' + l2
    if (l1)       return l1
    if (l2)       return l2
  } catch(_) {}

  /* Source 3: live header text */
  const h = document.getElementById('headerBrandName')?.textContent.trim()
  if (h && h.trim()) return h.trim()

  return 'Royal Restaurant'
}

function openForgotPassword() {
  closeModal('loginModal')
  const DEFAULT_MGR_EMAIL = 'naveenadhithya123@gmail.com'
  otpTargetEmail = localStorage.getItem('mgr_email') || DEFAULT_MGR_EMAIL

  /* Show MASKED email — readonly so user cannot edit */
  const displayEl = document.getElementById('forgotEmailDisplay')
  displayEl.value    = maskEmail(otpTargetEmail)
  displayEl.readOnly = true
  displayEl.style.cursor  = 'default'
  displayEl.style.opacity = '0.7'

  document.getElementById('forgotError').style.display = 'none'
  openModal('forgotModal')
}

/* ── STEP 1: Send OTP ── */
async function sendOTP() {
  const errEl = document.getElementById('forgotError')
  const btn   = document.getElementById('sendOtpBtn')

  if (!otpTargetEmail || !otpTargetEmail.includes('@')) {
    errEl.textContent = 'No manager email saved. Set it in Dashboard → Branding.'
    errEl.style.display = 'block'
    return
  }

  btn.textContent = 'Sending…'
  btn.disabled    = true
  errEl.style.display = 'none'

  try {
    const res  = await fetch(`${BACKEND}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: otpTargetEmail,
        restaurantName: (
          document.getElementById('headerBrandName')?.textContent.trim() ||
          localStorage.getItem('restName') ||
          'Royal Restaurant'
        )
      })
    })
    const data = await res.json()

    if (res.ok && data.success) {
      closeModal('forgotModal')
      document.getElementById('otpSentTo').textContent =
        `OTP sent to ${maskEmail(otpTargetEmail)}. Valid for 10 minutes.`
      document.getElementById('otpError').style.display = 'none'
      /* Clear 4 OTP boxes */
      for (let i = 0; i < 4; i++) {
        const box = document.getElementById(`otp${i}`)
        if (box) { box.value = ''; box.classList.remove('filled') }
      }
      openModal('otpModal')
      setTimeout(() => document.getElementById('otp0').focus(), 350)
      showToast('OTP sent to your email ✓', 'success')
    } else {
      errEl.textContent = data.error || 'Failed to send OTP.'
      errEl.style.display = 'block'
    }
  } catch (_) {
    errEl.textContent = 'Backend not running. Start node server.js first.'
    errEl.style.display = 'block'
  }

  btn.textContent = 'Send OTP'
  btn.disabled    = false
}

/* ── OTP box behaviour: auto-advance & backspace ── */
function otpBoxInput(el, idx) {
  el.value = el.value.replace(/[^0-9]/g, '')
  el.classList.toggle('filled', el.value !== '')
  if (el.value && idx < 3) {
    document.getElementById(`otp${idx + 1}`).focus()
  } else if (el.value && idx === 3) {
    /* Last digit entered — auto verify */
    setTimeout(() => verifyOTP(), 200)
  }
}

function otpBoxKey(event, idx) {
  if (event.key === 'Backspace' && !event.target.value && idx > 0) {
    document.getElementById(`otp${idx - 1}`).focus()
  }
  if (event.key === 'Enter') verifyOTP()
}

/* ── STEP 2: Verify OTP ── */
async function verifyOTP() {
  const otp   = Array.from({length:4}, (_,i) => document.getElementById(`otp${i}`).value).join('')
  const errEl = document.getElementById('otpError')

  if (otp.length < 4) {
    errEl.textContent = 'Please enter all 4 digits.'
    errEl.style.display = 'block'
    return
  }

  errEl.style.display = 'none'

  try {
    const res  = await fetch(`${BACKEND}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otpTargetEmail, otp })
    })
    const data = await res.json()

    if (res.ok && data.success) {
      closeModal('otpModal')
      document.getElementById('newPass1').value = ''
      document.getElementById('newPass2').value = ''
      document.getElementById('resetPassError').style.display = 'none'
      openModal('resetPassModal')
      setTimeout(() => document.getElementById('newPass1').focus(), 350)
      showToast('OTP verified ✓', 'success')
    } else {
      errEl.textContent = data.error || 'Incorrect OTP.'
      errEl.style.display = 'block'
      for (let i = 0; i < 4; i++) {
        const box = document.getElementById(`otp${i}`)
        if (box) { box.style.borderColor = 'var(--red)'; setTimeout(() => box.style.borderColor = '', 800) }
      }
    }
  } catch (_) {
    errEl.textContent = 'Backend not running. Start node server.js first.'
    errEl.style.display = 'block'
  }
}

/* ── STEP 3: Reset password ── */
async function resetPassword() {
  const p1    = document.getElementById('newPass1').value
  const p2    = document.getElementById('newPass2').value
  const errEl = document.getElementById('resetPassError')

  if (!p1 || p1.length < 3) {
    errEl.textContent = 'Password must be at least 3 characters.'
    errEl.style.display = 'block'
    return
  }
  if (p1 !== p2) {
    errEl.textContent = 'Passwords do not match.'
    errEl.style.display = 'block'
    return
  }
  errEl.style.display = 'none'

  /* Save to localStorage */
  localStorage.setItem('mgr_p', p1)

  /* Save to backend */
  try {
    await fetch(`${BACKEND}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: p1 })
    })
  } catch (_) {}

  /* Save to Supabase */
  const u = getMgrCreds().username
  await sbUpdateCredentials(u, p1).catch(() => {})

  closeModal('resetPassModal')
  showToast('Password updated successfully ✓', 'success')
  setTimeout(() => openModal('loginModal'), 500)
}

function saveMgrEmail() {
  const email = document.getElementById('br-email')?.value.trim()
  if (email) localStorage.setItem('mgr_email', email)
}
