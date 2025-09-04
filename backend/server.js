const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require('bcryptjs');
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// ✅ Register
app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
    [name, email, hashedPassword],
    function (err) {
      if (err) return res.status(400).json({ error: "Email already registered" });
      res.json({ message: "User registered successfully", userId: this.lastID });
    }
  );
});

// ✅ Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (!user) return res.status(400).json({ error: "Invalid credentials" });
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    res.json({ message: "Login successful", userId: user.id });
  });
});

// ✅ Get candidates
app.get("/api/candidates", (req, res) => {
  db.all("SELECT * FROM candidates", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ candidates: rows });
  });
});

// ✅ Cast vote
app.post("/api/vote", (req, res) => {
  const { userId, candidateId } = req.body;
  db.run(
    "INSERT INTO votes (user_id, candidate_id) VALUES (?, ?)",
    [userId, candidateId],
    function (err) {
      if (err) return res.status(400).json({ error: "User has already voted" });
      res.json({ message: "Vote cast successfully" });
    }
  );
});

// ✅ Results
app.get("/api/results", (req, res) => {
  const query = `
    SELECT candidates.name, candidates.party, COUNT(votes.id) as vote_count
    FROM candidates
    LEFT JOIN votes ON candidates.id = votes.candidate_id
    GROUP BY candidates.id
    ORDER BY vote_count DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ results: rows });
  });
});

// Fallback to frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
