// backend/server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const nodemailer = require("nodemailer");
const db = require("./db");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// serve uploaded profile images
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use("/uploads", express.static(UPLOAD_DIR));

// serve frontend if you mount everything from one service (optional)
// app.use(express.static(path.join(__dirname, "../frontend")));

const JWT_SECRET = process.env.JWT_SECRET || "local_secret_key";

// ---------- Multer for photo upload ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `user_${req.userId}_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// ---------- Nodemailer (Email OTP) ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: +(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "your@gmail.com",
    pass: process.env.SMTP_PASS || "your_app_password"
  }
});

async function sendOtpMail(to, otp) {
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER || "no-reply@ezeevote.app";
  await transporter.sendMail({
    from,
    to,
    subject: "Your EzeeVote OTP Code",
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
  });
}

// ---------- Helpers ----------
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

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

/* =================== AUTH =================== */
// Register -> create user (unverified) + email OTP
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.json({ error: "All fields required" });

  const hashed = await bcrypt.hash(password, 10);
  const otp = generateOTP();
  const expires = Date.now() + 10 * 60 * 1000; // 10 mins

  db.run(
    "INSERT INTO users (name, email, password, verified, otp_code, otp_expires) VALUES (?,?,?,?,?,?)",
    [name, email, hashed, 0, otp, expires],
    async function (err) {
      if (err) return res.json({ error: "Email exists or DB error" });
      try {
        await sendOtpMail(email, otp);
      } catch (e) {
        console.error("Mail error:", e.message);
      }
      res.json({ message: "Registered. OTP sent to email.", userId: this.lastID });
    }
  );
});

// Verify OTP
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.json({ error: "DB error" });
    if (!user) return res.json({ error: "User not found" });
    if (user.verified) return res.json({ message: "Already verified" });

    if (user.otp_code !== otp) return res.json({ error: "Invalid OTP" });
    if (Date.now() > (user.otp_expires || 0)) return res.json({ error: "OTP expired" });

    db.run(
      "UPDATE users SET verified = 1, otp_code = NULL, otp_expires = NULL WHERE id = ?",
      [user.id],
      (e2) => {
        if (e2) return res.json({ error: "DB error" });
        res.json({ message: "Email verified. You can login now." });
      }
    );
  });
});

// Login (only if verified)
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

/* =================== PROFILE =================== */
// Get current user profile
app.get("/api/me", auth, (req, res) => {
  db.get("SELECT id, name, email, profile_photo FROM users WHERE id = ?", [req.userId], (err, row) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ user: row });
  });
});

// Upload/Update profile photo
app.post("/api/profile/photo", auth, upload.single("photo"), (req, res) => {
  const relPath = `/uploads/${path.basename(req.file.path)}`;
  db.run("UPDATE users SET profile_photo = ? WHERE id = ?", [relPath, req.userId], (err) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ message: "Photo updated", photo: relPath });
  });
});

/* =================== VOTING =================== */
app.get("/api/candidates", (req, res) => {
  db.all("SELECT * FROM candidates", [], (err, rows) => {
    if (err) return res.json({ error: err.message });
    res.json({ candidates: rows });
  });
});

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

app.get("/api/results", (req, res) => {
  const q = `
    SELECT c.id, c.name, c.party, COUNT(v.id) AS vote_count
    FROM candidates c
    LEFT JOIN votes v ON c.id = v.candidate_id
    GROUP BY c.id
    ORDER BY vote_count DESC
  `;
  db.all(q, [], (err, rows) => {
    if (err) return res.json({ error: err.message });
    res.json({ results: rows });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
