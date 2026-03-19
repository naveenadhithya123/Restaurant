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
