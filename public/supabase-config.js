/* ============================================================
   supabase-config.js  —  Data Access Layer
   Replace SUPABASE_URL and SUPABASE_ANON_KEY with your values
   from: Supabase → Project Settings → API
============================================================ */

const SUPABASE_URL      = 'https://kqsrgxnfuzwangumjvfv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtxc3JneG5mdXp3YW5ndW1qdmZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTg1NzgsImV4cCI6MjA4OTI3NDU3OH0.roW2bg83F9Nu8Gu2RhN9hlPctweoI_htliLqEJKoN_Y'

/* ── Cloudinary config ── */
const CLOUDINARY_CLOUD  = 'drsrwnoxq'
const CLOUDINARY_PRESET = 'wkjlwsa9'

let sb = null

function initSupabase() {
  if (typeof window.supabase !== 'undefined' && SUPABASE_URL.startsWith('https://')) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    console.log('✦ Supabase connected')
    return true
  }
  console.warn('⚠ Supabase not configured — using localStorage fallback')
  return false
}

/* ══════════════════════════════════════
   CLOUDINARY IMAGE UPLOAD
   Uploads file → returns public URL
══════════════════════════════════════ */
async function uploadToCloudinary(file) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_PRESET)
  formData.append('folder', 'restaurant')

  const res  = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: formData }
  )
  if (!res.ok) throw new Error('Cloudinary upload failed')
  const data = await res.json()
  return data.secure_url   // ← this URL is stored in Supabase
}

/* ── PRODUCTS ─────────────────────────────────────────── */
async function sbGetProducts() {
  if (!sb) return null
  const { data, error } = await sb.from('products').select('*').order('id')
  return error ? null : data
}
async function sbAddProduct(p) {
  if (!sb) return null
  const { data, error } = await sb
    .from('products').insert([{ name:p.name, price:p.price, image:p.image||'' }]).select()
  return error ? null : data[0]
}
async function sbUpdateProduct(id, fields) {
  if (!sb) return null
  const { data, error } = await sb
    .from('products').update(fields).eq('id', id).select()
  return error ? null : data[0]
}
async function sbDeleteProduct(id) {
  if (!sb) return
  await sb.from('products').delete().eq('id', id)
}

/* ── BILLS ────────────────────────────────────────────── */
async function sbSaveBill(bill) {
  if (!sb) return null
  const { data, error } = await sb.from('bills').insert([{
    bill_no:  bill.bill_no,
    items:    bill.items,
    subtotal: bill.subtotal,
    tax:      bill.tax,
    total:    bill.total,
    currency: bill.currency || '₹'
  }]).select()
  return error ? null : data[0]
}
async function sbGetBills() {
  if (!sb) return null
  const { data, error } = await sb
    .from('bills').select('*').order('created_at', { ascending: false })
  return error ? null : data
}

/* ── MANAGER AUTH ─────────────────────────────────────── */
async function sbGetCredentials() {
  if (!sb) return null
  const { data, error } = await sb.from('manager_auth').select('*').limit(1).single()
  return error ? null : data
}
async function sbUpdateCredentials(username, password) {
  if (!sb) return false
  const { error } = await sb.from('manager_auth')
    .update({ username, password, updated_at: new Date().toISOString() })
    .eq('id', 1)
  return !error
}

/* ── APP SETTINGS ─────────────────────────────────────── */
async function sbSaveSetting(key, value) {
  if (!sb) return
  await sb.from('app_settings').upsert({
    key, value: JSON.stringify(value), updated_at: new Date().toISOString()
  })
}
async function sbGetSetting(key) {
  if (!sb) return null
  const { data, error } = await sb
    .from('app_settings').select('value').eq('key', key).single()
  if (error || !data) return null
  try { return JSON.parse(data.value) } catch { return data.value }
}
async function sbGetAllSettings() {
  if (!sb) return null
  const { data, error } = await sb.from('app_settings').select('*')
  if (error || !data) return null
  const out = {}
  data.forEach(r => { try { out[r.key] = JSON.parse(r.value) } catch { out[r.key] = r.value } })
  return out
}

/* ── ORDERS ────────────────────────────────────────── */
async function sbCreateOrder(table_no, items) {
  if (!sb) return null
  const { data, error } = await sb.from('orders')
    .insert([{ table_no, items, status: 'pending' }]).select()
  return error ? null : data[0]
}

async function sbGetActiveOrders() {
  if (!sb) return null
  const { data, error } = await sb.from('orders')
    .select('*, order_items(*)')
    .not('status', 'eq', 'billed')
    .order('created_at', { ascending: true })
  return error ? null : data
}

async function sbGetOrderItems(order_id) {
  if (!sb) return null
  const { data, error } = await sb.from('order_items')
    .select('*').eq('order_id', order_id)
    .order('created_at', { ascending: true })
  return error ? null : data
}

async function sbAddOrderItems(order_id, items, is_parcel=false) {
  if (!sb) return null
  const rows = items.map(i => ({
    order_id, item_name: i.name,
    quantity: i.qty, price: i.price, is_parcel,
    status: 'pending'
  }))
  const { data, error } = await sb.from('order_items').insert(rows).select()
  return error ? null : data
}

async function sbUpdateOrderItemStatus(item_id, status) {
  if (!sb) return null
  const { error } = await sb.from('order_items')
    .update({ status }).eq('id', item_id)
  return !error
}

async function sbUpdateOrderStatus(order_id, status) {
  if (!sb) return null
  const { error } = await sb.from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', order_id)
  return !error
}

async function sbGetOrdersByStatus(status) {
  if (!sb) return null
  const { data, error } = await sb.from('orders')
    .select('*, order_items(*)')
    .eq('status', status)
    .order('created_at', { ascending: true })
  return error ? null : data
}



/* ══════════════════════════════════════
   REALTIME SUBSCRIPTIONS
══════════════════════════════════════ */
function initRealtime() {
  if (!sb) return

  function debounce(fn, delay = 300) {
    let timer
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay) }
  }

  // Products
  sb.channel('products-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' },
      debounce(async () => {
        const data = await sbGetProducts()
        if (data) {
          window.products = data
          if (typeof loadProducts === 'function') loadProducts()
          if (typeof loadDashProducts === 'function') loadDashProducts()
          if (typeof loadServerProducts === 'function') loadServerProducts()
        }
      }))
    .subscribe()

  // App settings
  sb.channel('settings-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' },
      debounce(async () => {
        const settings = await sbGetAllSettings()
        if (settings) {
          if (settings.branding && typeof applyBrandingData === 'function')
            applyBrandingData(settings.branding)
          if (settings.taxRate) window.taxRate = parseInt(settings.taxRate)
          if (settings.currency && typeof setCurrencyVal === 'function')
            setCurrencyVal(settings.currency)
        }
      }))
    .subscribe()

  // Orders
  sb.channel('orders-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
      debounce(() => {
        if (typeof loadKitchen === 'function') loadKitchen()
        if (typeof loadCaptain === 'function') loadCaptain()
        if (typeof loadServerReceived === 'function') loadServerReceived()
        if (typeof loadBillCounterPending === 'function') loadBillCounterPending()
      }))
    .subscribe()

  // Order items
  sb.channel('order-items-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },
      debounce(() => {
        if (typeof loadKitchen === 'function') loadKitchen()
        if (typeof loadCaptain === 'function') loadCaptain()
        if (typeof loadServerReceived === 'function') loadServerReceived()
      }))
    .subscribe()

  // Bills
  sb.channel('bills-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' },
      debounce(async () => {
        const bills = await sbGetBills()
        if (bills) {
          window.billsCache = bills
          localStorage.setItem('billsCache', JSON.stringify(bills))
          if (typeof updateDashStats === 'function') updateDashStats()
          if (typeof renderDatabase === 'function') renderDatabase()
        }
      }))
    .subscribe()

  console.log('✦ Realtime subscriptions active')
}
