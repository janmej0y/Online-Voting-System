// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("./db");

const app = express();
app.use(bodyParser.json());

// ----------------- CORS -----------------
// replace with your Vercel domain or keep "*" while testing
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://online-voting-system-henna.vercel.app";
app.use(cors({
  origin: FRONTEND_ORIGIN,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// ----------------- STATIC -----------------
app.use('/images', express.static(path.join(__dirname, "../frontend/images"))); // candidate symbols
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use("/uploads", express.static(UPLOAD_DIR));

// ----------------- CONFIG -----------------
const JWT_SECRET = process.env.JWT_SECRET || "fallback_local_secret_123!";
const TOKEN_EXP = "2h";

// ----------------- Multer for profile photo -----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // req.userId may not exist for unauth; we set temporary name if missing
    const id = req.userId || "anon";
    const ext = path.extname(file.originalname || "");
    cb(null, `user_${id}_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// ----------------- Nodemailer -----------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: +(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || ""
  }
});

// Send OTP Email
async function sendOtpMail(to, otp) {
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER || "no-reply@ezeevote.app";
  try {
    await transporter.sendMail({
      from,
      to,
      subject: "Your EzeeVote OTP Code",
      text: `Your OTP is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your OTP for <strong>EzeeVote</strong> is <b>${otp}</b>. Expires in 10 minutes.</p>`
    });
    console.log("✅ OTP sent to", to);
    return true;
  } catch (err) {
    console.error("❌ OTP Email Error:", err.message || err);
    return false;
  }
}

// Send Reset Password Email
async function sendResetMail(to, token) {
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER || "no-reply@ezeevote.app";
  const frontend = process.env.FRONTEND_ORIGIN || "https://online-voting-system-henna.vercel.app";
  const resetUrl = `${frontend}/?reset_token=${token}`;
  try {
    await transporter.sendMail({
      from,
      to,
      subject: "EzeeVote Password Reset",
      text: `Reset link: ${resetUrl} (expires in 30 minutes)`,
      html: `<p>Click to reset your password: <a href="${resetUrl}">${resetUrl}</a> (expires in 30 min)</p>`
    });
    console.log("✅ Reset email sent to", to);
    return true;
  } catch (err) {
    console.error("❌ Reset Email Error:", err.message || err);
    return false;
  }
}


// ----------------- Helpers -----------------
function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXP });
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
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function genRandomHex(len = 32) {
  return crypto.randomBytes(len).toString("hex");
}

// ----------------- Routes -----------------
app.get("/", (req, res) => res.send("✅ EzeeVote Backend Running"));

// ---------- REGISTER ----------
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.json({ error: "All fields required" });

  // check existing
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.json({ error: "DB error" });

    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 min
    const hashed = await bcrypt.hash(password, 10);

    // If user exists
    if (user) {
      if (user.verified) {
        return res.json({ error: "Email already registered and verified. Please login or use forgot password." });
      } else {
        // update OTP + password (allow re-register to set new password)
        db.run("UPDATE users SET name=?, password=?, otp_code=?, otp_expires=? WHERE id=?", [name, hashed, otp, otpExpires, user.id], async function (uErr) {
          if (uErr) {
            return res.json({ error: "DB error" });
          }
          // send email in background; respond immediately
          sendOtpMail(email, otp).catch(console.error);
          return res.json({ message: "Existing unverified account updated. OTP re-sent.", userId: user.id });
        });
        return;
      }
    }

    // New user
    db.run("INSERT INTO users (name, email, password, verified, otp_code, otp_expires) VALUES (?,?,?,?,?,?)",
      [name, email, hashed, 0, otp, otpExpires],
      function (insertErr) {
        if (insertErr) return res.json({ error: "DB error during insert" });
        // send OTP email but do not block response
        sendOtpMail(email, otp).catch(console.error);
        res.json({ message: "Registered. OTP sent to email.", userId: this.lastID });
      });
  });
});

// ---------- RESEND OTP ----------
app.post("/api/resend-otp", (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ error: "Email required" });

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.json({ error: "DB error" });
    if (!user) return res.json({ error: "User not found" });
    if (user.verified) return res.json({ message: "Already verified" });

    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000;
    db.run("UPDATE users SET otp_code=?, otp_expires=? WHERE id=?", [otp, otpExpires, user.id], (uErr) => {
      if (uErr) return res.json({ error: "DB error" });
      // send in background
      sendOtpMail(email, otp).then(ok => {
        if (ok) res.json({ message: "OTP resent to email." });
        else res.json({ message: "OTP generated but failed to send email (check SMTP settings)." });
      }).catch(() => res.json({ message: "OTP generated but failed to send email." }));
    });
  });
});

// ---------- VERIFY OTP ----------
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.json({ error: "Email and OTP required" });

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.json({ error: "DB error" });
    if (!user) return res.json({ error: "User not found" });
    if (user.verified) return res.json({ message: "Already verified" });
    if (!user.otp_code || user.otp_code !== otp) return res.json({ error: "Invalid OTP" });
    if (Date.now() > (user.otp_expires || 0)) return res.json({ error: "OTP expired" });

    db.run("UPDATE users SET verified=1, otp_code=NULL, otp_expires=NULL WHERE id=?", [user.id], (uErr) => {
      if (uErr) return res.json({ error: "DB error" });
      res.json({ message: "Email verified. You can login now." });
    });
  });
});

// ---------- LOGIN ----------
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ error: "Email and password required" });

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.json({ error: "DB error" });
    if (!user) return res.json({ error: "User not found" });
    if (!user.verified) return res.json({ error: "Email not verified" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json({ error: "Invalid credentials" });

    const token = createToken({ id: user.id, email: user.email });
    res.json({ message: "Login successful", token, userId: user.id, name: user.name, photo: user.profile_photo });
  });
});

// ---------- FORGOT PASSWORD ----------
app.post("/api/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ error: "Email required" });

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.json({ error: "DB error" });
    if (!user) return res.json({ error: "User not found" });

    const token = genRandomHex(20);
    const expires = Date.now() + 30 * 60 * 1000; // 30 minutes
    db.run("UPDATE users SET reset_token=?, reset_expires=? WHERE id=?", [token, expires, user.id], (uErr) => {
      if (uErr) return res.json({ error: "DB error" });
      sendResetMail(email, token).then(ok => {
        if (ok) res.json({ message: "Password reset link sent to email." });
        else res.json({ message: "Reset token generated but failed to send email (check SMTP)." });
      }).catch(() => res.json({ message: "Reset token generated but failed to send email." }));
    });
  });
});

// ---------- RESET PASSWORD ----------
app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.json({ error: "Token and new password required" });

  db.get("SELECT * FROM users WHERE reset_token = ?", [token], async (err, user) => {
    if (err) return res.json({ error: "DB error" });
    if (!user) return res.json({ error: "Invalid token" });
    if (Date.now() > (user.reset_expires || 0)) return res.json({ error: "Reset token expired" });

    const hashed = await bcrypt.hash(newPassword, 10);
    db.run("UPDATE users SET password=?, reset_token=NULL, reset_expires=NULL WHERE id=?", [hashed, user.id], (uErr) => {
      if (uErr) return res.json({ error: "DB error" });
      res.json({ message: "Password reset successful. You can login now." });
    });
  });
});

// ---------- PROFILE (get currently logged user) ----------
app.get("/api/me", auth, (req, res) => {
  db.get("SELECT id, name, email, profile_photo FROM users WHERE id = ?", [req.userId], (err, row) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ user: row });
  });
});

// ---------- UPLOAD PROFILE PHOTO ----------
app.post("/api/profile/photo", auth, upload.single("photo"), (req, res) => {
  if (!req.file) return res.json({ error: "No file uploaded" });
  const rel = `/uploads/${path.basename(req.file.path)}`;
  db.run("UPDATE users SET profile_photo=? WHERE id=?", [rel, req.userId], (err) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ message: "Photo uploaded", photo: rel });
  });
});

// ---------- CANDIDATES ----------
app.get("/api/candidates", (req, res) => {
  db.all("SELECT id, name, party, image FROM candidates", [], (err, rows) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ candidates: rows });
  });
});

// ---------- VOTE ----------
app.post("/api/vote", auth, (req, res) => {
  const { candidateId } = req.body;
  const userId = req.userId;
  db.get("SELECT 1 FROM votes WHERE user_id = ?", [userId], (err, row) => {
    if (err) return res.json({ error: "DB error" });
    if (row) return res.json({ error: "You have already voted!" });
    db.run("INSERT INTO votes (user_id, candidate_id) VALUES (?,?)", [userId, candidateId], (e2) => {
      if (e2) return res.json({ error: "DB error" });
      res.json({ message: "✅ Vote cast successfully!" });
    });
  });
});

// ---------- RESULTS ----------
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

// START SERVER
const PORT = +(process.env.PORT || 5000);
app.listen(PORT, () => console.log(`✅ Server running on Render at port ${PORT}`));
