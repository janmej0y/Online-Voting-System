// backend/server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const db = require("./db");

const app = express();
app.use(bodyParser.json());

// CORS: set your frontend origin(s) here (Vercel URL or local)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5500";
app.use(cors({
  origin: FRONTEND_ORIGIN,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

// static images (candidate images inside frontend/images)
app.use('/images', express.static(path.join(__dirname, "../frontend/images")));

// uploads for profile photos
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use('/uploads', express.static(UPLOAD_DIR));

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || "5ab4f9289e4ef9e9b3323114c0f7c5e2"; // replace in env

// Multer for photo upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `user_${req.userId || "anon"}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Nodemailer transport (Brevo or Gmail)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: +(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || ""
  }
});

// helper functions
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
}
function auth(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ error: "No token" });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid token" });
    req.userId = decoded.id;
    next();
  });
}

async function sendOtpMail(to, otp) {
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER || "no-reply@ezeevote.app";
  try {
    await transporter.sendMail({
      from,
      to,
      subject: "EzeeVote OTP Code",
      text: `Your OTP is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your OTP for <strong>EzeeVote</strong>: <b>${otp}</b> (expires in 10 minutes)</p>`
    });
    console.log("✅ OTP email queued to:", to);
    return true;
  } catch (err) {
    console.error("❌ OTP Email Error:", err.message || err);
    return false;
  }
}

async function sendResetMail(to, token) {
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER || "no-reply@ezeevote.app";
  const frontend = process.env.FRONTEND_ORIGIN || FRONTEND_ORIGIN;
  const url = `${frontend}/?reset_token=${token}`;
  try {
    await transporter.sendMail({
      from,
      to,
      subject: "EzeeVote Password Reset",
      text: `Reset link: ${url} (30 minutes)`,
      html: `<p>Reset your password: <a href="${url}">${url}</a> (valid 30 minutes)</p>`
    });
    console.log("✅ Reset mail queued to:", to);
    return true;
  } catch (err) {
    console.error("❌ Reset Email Error:", err.message || err);
    return false;
  }
}

/* ROUTES */

// health
app.get("/", (req, res) => res.send("✅ EzeeVote Backend Running"));

// register -> save user + generate otp (send OTP async, respond fast)
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.json({ error: "All fields required" });

  const hashed = await bcrypt.hash(password, 10);
  const otp = generateOTP();
  const expires = Date.now() + 10 * 60 * 1000;

  db.run(
    "INSERT INTO users (name, email, password, verified, otp_code, otp_expires) VALUES (?,?,?,?,?,?)",
    [name, email, hashed, 0, otp, expires],
    function (err) {
      if (err) return res.json({ error: "Email already exists" });

      // ✅ SEND RESPONSE IMMEDIATELY (Fast UI)
      res.json({
        message: "Registered! OTP sent.",
        userId: this.lastID,
      });

      // ⏳ Send OTP in BACKGROUND (FASTEST FIX)
      sendOtpMail(email, otp)
        .then(() => console.log("OTP sent to:", email))
        .catch((err) => console.log("OTP Error:", err.message));
    }
  );
});


// resend OTP
app.post("/api/resend-otp", (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ error: "Email required" });
  const otp = generateOTP();
  const expires = Date.now() + 10*60*1000;
  db.run("UPDATE users SET otp_code = ?, otp_expires = ? WHERE email = ?", [otp, expires, email], async function(err) {
    if (err) return res.json({ error: "DB error" });
    // check if updated row exists
    if (this.changes === 0) return res.json({ error: "User not found" });
    // send async
    sendOtpMail(email, otp).catch(err => console.error("OTP resend error:", err));
    res.json({ message: "OTP resent (check your inbox)" });
  });
});

// verify OTP
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.json({ error: "Email+OTP required" });
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.json({ error: "DB error" });
    if (!user) return res.json({ error: "User not found" });
    if (user.verified) return res.json({ message: "Already verified" });
    if (user.otp_code !== otp) return res.json({ error: "Invalid OTP" });
    if (Date.now() > (user.otp_expires || 0)) return res.json({ error: "OTP expired" });
    db.run("UPDATE users SET verified=1, otp_code=NULL, otp_expires=NULL WHERE id=?", [user.id], (e) => {
      if (e) return res.json({ error: "DB error" });
      res.json({ message: "Email verified" });
    });
  });
});

// login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.json({ error: "DB error" });
    if (!user) return res.json({ error: "User not found" });
    if (!user.verified) return res.json({ error: "Email not verified" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json({ error: "Invalid credentials" });
    const token = signToken({ id: user.id, email: user.email });
    res.json({ message: "Login successful", token, userId: user.id, name: user.name, photo: user.profile_photo });
  });
});

// forgot password -> create reset token, send link
app.post("/api/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ error: "Email required" });
  const token = crypto.randomBytes(20).toString("hex");
  const expires = Date.now() + 30*60*1000; // 30m
  db.run("UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?", [token, expires, email], function(err) {
    if (err) return res.json({ error: "DB error" });
    if (this.changes === 0) return res.json({ error: "User not found" });
    sendResetMail(email, token).catch(e => console.error("Reset mail error:", e));
    res.json({ message: "Reset link sent to email (if account exists)" });
  });
});

// reset password
app.post("/api/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.json({ error: "Token+password required" });
  db.get("SELECT * FROM users WHERE reset_token = ?", [token], async (err, user) => {
    if (err) return res.json({ error: "DB error" });
    if (!user) return res.json({ error: "Invalid token" });
    if (Date.now() > (user.reset_expires || 0)) return res.json({ error: "Token expired" });
    const hashed = await bcrypt.hash(password, 10);
    db.run("UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?", [hashed, user.id], (e) => {
      if (e) return res.json({ error: "DB error" });
      res.json({ message: "Password reset successful" });
    });
  });
});

// get current user
app.get("/api/me", auth, (req, res) => {
  db.get("SELECT id,name,email,profile_photo FROM users WHERE id=?", [req.userId], (err, row) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ user: row });
  });
});

// profile photo upload
app.post("/api/profile/photo", auth, upload.single("photo"), (req, res) => {
  const rel = `/uploads/${path.basename(req.file.path)}`;
  db.run("UPDATE users SET profile_photo = ? WHERE id = ?", [rel, req.userId], (err) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ message: "Photo uploaded", photo: rel });
  });
});

// candidates
app.get("/api/candidates", (req, res) => {
  db.all("SELECT id,name,party,image FROM candidates", [], (err, rows) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ candidates: rows });
  });
});

// vote (authenticated)
app.post("/api/vote", auth, (req, res) => {
  const { candidateId } = req.body;
  const userId = req.userId;
  db.get("SELECT 1 FROM votes WHERE user_id = ?", [userId], (err, row) => {
    if (err) return res.json({ error: "DB error" });
    if (row) return res.json({ error: "Already voted" });
    db.run("INSERT INTO votes (user_id,candidate_id) VALUES (?,?)", [userId, candidateId], (e) => {
      if (e) return res.json({ error: "DB error" });
      res.json({ message: "Vote cast" });
    });
  });
});

// results
app.get("/api/results", (req, res) => {
  const q = `
    SELECT c.id, c.name, c.party, COUNT(v.id) AS vote_count
    FROM candidates c
    LEFT JOIN votes v ON c.id = v.candidate_id
    GROUP BY c.id
    ORDER BY vote_count DESC
  `;
  db.all(q, [], (err, rows) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ results: rows });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
