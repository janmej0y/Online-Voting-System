// backend/server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { OAuth2Client } = require("google-auth-library");
const db = require("./db");

const app = express();
app.use(bodyParser.json());

// ================================
// 🔐 CORS CONFIG
// ================================
const allowedOrigins = [
  "https://online-voting-system-henna.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ================================
// 📁 STATIC FILE SUPPORT
// ================================
app.use("/images", express.static(path.join(__dirname, "../frontend/images")));

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use("/uploads", express.static(UPLOAD_DIR));

// ================================
// 🔐 AUTH HELPERS
// ================================
const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(data) {
  return jwt.sign(data, JWT_SECRET, { expiresIn: "2h" });
}

function extractToken(req) {
  const header = req.headers["authorization"];
  if (!header) return null;
  return header.startsWith("Bearer ") ? header.slice(7) : header;
}

function auth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Missing token" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid token" });
    req.userId = decoded.id;
    next();
  });
}

// ================================
// 📷 MULTER FILE UPLOAD
// ================================
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = "user_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  }
});
const upload = multer({ storage });

// ================================
// 🌍 HEALTH ROUTE
// ================================
app.get("/", (_, res) => res.send("✅ EzeeVote Backend Running (Google Login Enabled)"));

// ================================
// 🔑 GOOGLE LOGIN API
// ================================
app.post("/api/google-login", async (req, res) => {
  const { idToken } = req.body;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    // Check if user exists
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
      if (err) return res.json({ error: "DB error" });

      // If new user → create account automatically
      if (!user) {
        db.run(
          "INSERT INTO users (name, email, verified, profile_photo) VALUES (?,?,1,?)",
          [name, email, picture],
          function (err2) {
            if (err2) return res.json({ error: "DB error" });

            const token = signToken({ id: this.lastID });
            return res.json({
              token,
              userId: this.lastID,
              name,
              photo: picture
            });
          }
        );
      } else {
        const token = signToken({ id: user.id });

        return res.json({
          token,
          userId: user.id,
          name: user.name,
          photo: user.profile_photo
        });
      }
    });
  } catch (err) {
    console.error("Google Login Error:", err);
    res.json({ error: "Google authentication failed" });
  }
});

// ================================
// 👤 GET LOGGED-IN USER PROFILE
// ================================
app.get("/api/me", auth, (req, res) => {
  db.get("SELECT id,name,email,profile_photo FROM users WHERE id=?", [req.userId], (err, row) => {
    if (err || !row) return res.json({ error: "User not found" });
    res.json({ user: row });
  });
});

// ================================
// 📸 UPLOAD PROFILE PHOTO
// ================================
app.post("/api/profile/photo", auth, upload.single("photo"), (req, res) => {
  if (!req.file) return res.json({ error: "No file uploaded" });

  const pathRel = "/uploads/" + req.file.filename;

  db.run("UPDATE users SET profile_photo = ? WHERE id = ?", [pathRel, req.userId], (err) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ message: "Photo updated", photo: pathRel });
  });
});

// ================================
// 🗳 LIST CANDIDATES
// ================================
app.get("/api/candidates", (_, res) => {
  db.all("SELECT id,name,party,image FROM candidates", [], (err, rows) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ candidates: rows });
  });
});

// ================================
// 🗳 CAST VOTE (ONLY ONCE)
// ================================
app.post("/api/vote", auth, (req, res) => {
  const { candidateId } = req.body;
  const userId = req.userId;

  if (!candidateId) return res.json({ error: "candidateId required" });

  // Check if already voted
  db.get("SELECT 1 FROM votes WHERE user_id=?", [userId], (err, row) => {
    if (err) return res.json({ error: "DB error" });
    if (row) return res.json({ error: "Already voted" });

    db.run("INSERT INTO votes (user_id,candidate_id) VALUES (?,?)", [userId, candidateId], (e) => {
      if (e) return res.json({ error: "DB error" });
      res.json({ message: "Vote cast successfully" });
    });
  });
});

// ================================
// 📊 RESULTS
// ================================
app.get("/api/results", (_, res) => {
  const query = `
    SELECT c.id, c.name, c.party, COUNT(v.id) as vote_count
    FROM candidates c
    LEFT JOIN votes v ON c.id = v.candidate_id
    GROUP BY c.id
    ORDER BY vote_count DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.json({ error: "DB error" });
    res.json({ results: rows });
  });
});

// ================================
// 🚀 START SERVER
// ================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
