const express    = require("express")
const cors       = require("cors")
const path       = require("path")
const jwt        = require("jsonwebtoken")
const bcrypt     = require("bcryptjs")
const nodemailer = require("nodemailer")
const pool       = require("./db")

const app    = express()
const SECRET = process.env.JWT_SECRET || "restaurantsecret_change_in_production"

app.use(cors())
app.use(express.json({ limit: "10mb" }))

/* ── Serve frontend static files ── */
app.use(express.static(path.join(__dirname, "public")))

/* ══════════════════════════════════════════
   GMAIL CONFIG
   Set these in Render → Environment Variables
══════════════════════════════════════════ */
const GMAIL_USER = process.env.GMAIL_USER || "lap100gbfree@gmail.com"
const GMAIL_PASS = process.env.GMAIL_PASS || "ehjh nmfh odsb shco"

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000
})

/* In-memory OTP store */
const otpStore = {}

/* ── Auth middleware ── */
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"]
  if (!authHeader) return res.status(401).json({ error: "No token provided" })
  const token = authHeader.split(" ")[1]
  try { req.user = jwt.verify(token, SECRET); next() }
  catch { res.status(403).json({ error: "Invalid token" }) }
}

/* ══════════════════════════════════════
   OTP — SEND
══════════════════════════════════════ */
app.post("/send-otp", async (req, res) => {
  try {
    const { email, restaurantName } = req.body
    if (!email) return res.status(400).json({ error: "Email is required" })

    const otp       = Math.floor(1000 + Math.random() * 9000).toString()
    const expiresAt = Date.now() + 10 * 60 * 1000
    const restName  = restaurantName || "Royal Restaurant"

    otpStore[email] = { otp, expiresAt }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
      sender: { name: restName, email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: email }],
      subject: `Your OTP — ${restName}`,
      htmlContent: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f4ec;border-radius:12px">
        <h2 style="color:#2a2218;margin-bottom:8px">${restName}</h2>
        <p style="color:#5a4a35;font-size:14px">Password reset requested.</p>
        <div style="background:#fff;border-radius:10px;padding:24px;text-align:center;margin:24px 0;border:1px solid #e0d4bc">
          <p style="color:#9a8060;font-size:12px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Your OTP</p>
          <h1 style="font-size:52px;color:#8a5e2a;letter-spacing:12px;margin:0">${otp}</h1>
      </div>
      <p style="color:#9a8060;font-size:12px">Expires in <strong>10 minutes</strong>. Do not share with anyone.</p>
      <p style="color:#c4a87a;font-size:11px;margin-top:20px">If you did not request this, ignore this email.</p>
    </div>`
})
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.message || 'Brevo API error')
    }

    res.json({ success: true })
  } catch (err) {
    console.error("Send OTP error:", err.message)
    res.status(500).json({ error: "Failed to send OTP: " + err.message })
  }
})

/* ══════════════════════════════════════
   OTP — VERIFY
══════════════════════════════════════ */
app.post("/verify-otp", (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" })
    const record = otpStore[email]
    if (!record) return res.status(400).json({ error: "No OTP found. Request a new one." })
    if (Date.now() > record.expiresAt) {
      delete otpStore[email]
      return res.status(400).json({ error: "OTP expired. Request a new one." })
    }
    if (record.otp !== otp.toString()) return res.status(400).json({ error: "Incorrect OTP." })
    delete otpStore[email]
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Server error" })
  }
})

/* ══════════════════════════════════════
   RESET PASSWORD
══════════════════════════════════════ */
app.post("/reset-password", async (req, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 3)
      return res.status(400).json({ error: "Password too short" })
    try {
      await pool.query("UPDATE manager_auth SET password=$1, updated_at=NOW() WHERE id=1", [newPassword])
    } catch (_) {}
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Server error" })
  }
})

/* ══════════════════════════════════════
   PRODUCTS
══════════════════════════════════════ */
app.get("/products", async (req, res) => {
  try {
    const data = await pool.query("SELECT * FROM products ORDER BY id")
    res.json(data.rows)
  } catch (err) { res.status(500).json({ error: "Server error" }) }
})

app.post("/products", authMiddleware, async (req, res) => {
  try {
    const { name, price, image } = req.body
    if (!name || !price) return res.status(400).json({ error: "Name and price required" })
    await pool.query("INSERT INTO products(name,price,image) VALUES($1,$2,$3)", [name, Number(price), image||""])
    res.json({ message: "Product added" })
  } catch (err) { res.status(500).json({ error: "Server error" }) }
})

app.delete("/products/:id", authMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM products WHERE id=$1", [req.params.id])
    res.json({ message: "Deleted" })
  } catch (err) { res.status(500).json({ error: "Server error" }) }
})

/* ── Serve frontend for all other routes ── */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`✦ Server running on port ${PORT}`))

// Keep server awake on Render free tier
setInterval(() => {
  fetch(`https://restaurant-updated-at8o.onrender.com/products`)
    .catch(() => {}) // silent ping every 14 minutes
}, 14 * 60 * 1000)
