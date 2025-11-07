// ===============================
// ✅ EzeeVote – Backend Server
// ===============================

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("./db");
require("dotenv").config();

const app = express();

// ===========================================
// ✅ 1. MIDDLEWARE
// ===========================================
app.use(bodyParser.json());

// ✅ CORS – allow Vercel frontend
app.use(
  cors({
    origin: "https://online-voting-system-henna.vercel.app",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ===========================================
// ✅ 2. STATIC FILES (Images + Uploaded photos)
// ===========================================

// Candidate party symbols (from frontend/images)
app.use(
  "/images",
  express.static(path.join(__dirname, "../frontend/images"))
);

// User uploaded profile images
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.use("/uploads", express.static(UPLOAD_DIR));

// ===========================================
// ✅ 3. SECURITY CONSTANTS
// ===========================================
const JWT_SECRET = process.env.JWT_SECRET || "fallback_local_secret_123!";

// ===========================================
// ✅ 4. MULTER – Profile Upload Management
// ===========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `user_${req.userId}_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// ===========================================
// ✅ 5. NODEMAILER – OTP Email Sender
// ===========================================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: +(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "your@gmail.com",
    pass: process.env.SMTP_PASS || "your_gmail_app_password",
  },
});

async function sendOtpMail(to, otp) {
  const from =
    process.env.FROM_EMAIL || process.env.SMTP_USER || "no-reply@ezeevote.com";

  await transporter.sendMail({
    from,
    to,
    subject: "Your EzeeVote OTP Verification",
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
  });
}

// ===========================================
// ✅ 6. AUTH HELPERS
// ===========================================

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
}

function auth(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid token" });

    req.userId = decoded.id;
    next();
  });
}

// ===============================
// ✅ 7. ROUTES START HERE
// ===============================

// ✅ Health Check
app.get("/", (req, res) => {
  res.send("✅ EzeeVote Backend Running Successfully");
});

// ---------------------
// ✅ REGISTER USER
// ---------------------
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
    async function (err) {
      if (err) return res.json({ error: "Email already exists" });

      try {
        await sendOtpMail(email, otp);
      } catch (mailErr) {
        console.log("❌ OTP Email Error:", mailErr.message);
      }

      res.json({
        message: "✅ Registered! OTP sent to email.",
        userId: this.lastID,
      });
    }
  );
});

// ---------------------
// ✅ VERIFY OTP
// ---------------------
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.json({ error: "DB error" });
    if (!user) return res.json({ error: "User not found" });

    if (user.verified) return res.json({ message: "Already Verified ✅" });

    if (user.otp_code !== otp) return res.json({ error: "Invalid OTP" });
    if (Date.now() > user.otp_expires)
      return res.json({ error: "OTP expired" });

    db.run(
      "UPDATE users SET verified = 1, otp_code = NULL, otp_expires = NULL WHERE id = ?",
      [user.id],
      () => res.json({ message: "✅ OTP Verified! You can now login." })
    );
  });
});

// ---------------------
// ✅ LOGIN USER
// ---------------------
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (!user) return res.json({ error: "User not found" });
    if (!user.verified) return res.json({ error: "Email not verified" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json({ error: "Invalid credentials" });

    const token = createToken({ id: user.id, email: user.email });

    res.json({
      message: "✅ Login Successful",
      token,
      userId: user.id,
      name: user.name,
      photo: user.profile_photo,
    });
  });
});

// -----------------------------------
// ✅ GET USER PROFILE
// -----------------------------------
app.get("/api/me", auth, (req, res) => {
  db.get(
    "SELECT id, name, email, profile_photo FROM users WHERE id = ?",
    [req.userId],
    (err, row) => res.json({ user: row })
  );
});

// -----------------------------------
// ✅ UPLOAD PROFILE PHOTO
// -----------------------------------
app.post("/api/profile/photo", auth, upload.single("photo"), (req, res) => {
  const relPath = `/uploads/${path.basename(req.file.path)}`;
  db.run(
    "UPDATE users SET profile_photo = ? WHERE id = ?",
    [relPath, req.userId],
    () => res.json({ message: "✅ Photo updated", photo: relPath })
  );
});

// -----------------------------------
// ✅ GET CANDIDATES
// -----------------------------------
app.get("/api/candidates", (req, res) => {
  db.all("SELECT * FROM candidates", [], (err, rows) => {
    if (err) return res.json({ error: err.message });
    res.json({ candidates: rows });
  });
});

// -----------------------------------
// ✅ CAST VOTE
// -----------------------------------
app.post("/api/vote", auth, (req, res) => {
  const { candidateId } = req.body;
  const userId = req.userId;

  db.get("SELECT 1 FROM votes WHERE user_id = ?", [userId], (err, row) => {
    if (row) return res.json({ error: "You have already voted!" });

    db.run(
      "INSERT INTO votes (user_id, candidate_id) VALUES (?,?)",
      [userId, candidateId],
      () => res.json({ message: "✅ Vote cast successfully!" })
    );
  });
});

// -----------------------------------
// ✅ GET RESULTS
// -----------------------------------
app.get("/api/results", (req, res) => {
  const q = `
    SELECT c.id, c.name, c.party, COUNT(v.id) AS vote_count
    FROM candidates c
    LEFT JOIN votes v ON c.id = v.candidate_id
    GROUP BY c.id
    ORDER BY vote_count DESC
  `;
  db.all(q, [], (err, rows) => res.json({ results: rows }));
});

// ===============================
// ✅ START SERVER
// ===============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on Render at port ${PORT}`)
);

