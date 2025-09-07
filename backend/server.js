const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const db = require("./db"); // <-- db.js (SQLite)

const app = express();
app.use(cors());
app.use(bodyParser.json());

/* ----------------- USER AUTH ----------------- */
// Register
app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.json({ error: "All fields required" });
  }

  db.run(
    "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
    [name, email, password],
    function (err) {
      if (err) {
        return res.json({ error: "Email already exists or invalid" });
      }
      res.json({ message: "Registration successful", userId: this.lastID });
    }
  );
});

// Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE email = ? AND password = ?",
    [email, password],
    (err, row) => {
      if (err) return res.json({ error: err.message });
      if (!row) return res.json({ error: "Invalid credentials" });

      res.json({ message: "Login successful", userId: row.id });
    }
  );
});

/* ----------------- CANDIDATES ----------------- */
// Get candidates
app.get("/api/candidates", (req, res) => {
  db.all("SELECT * FROM candidates", [], (err, rows) => {
    if (err) return res.json({ error: err.message });
    res.json({ candidates: rows });
  });
});

/* ----------------- VOTING ----------------- */
// Cast vote
app.post("/api/vote", (req, res) => {
  const { userId, candidateId } = req.body;

  if (!userId || !candidateId) {
    return res.json({ error: "Missing data" });
  }

  // Check if user has already voted
  db.get("SELECT * FROM votes WHERE user_id = ?", [userId], (err, row) => {
    if (err) return res.json({ error: err.message });
    if (row) return res.json({ error: "You have already voted!" });

    db.run(
      "INSERT INTO votes (user_id, candidate_id) VALUES (?, ?)",
      [userId, candidateId],
      function (err) {
        if (err) return res.json({ error: err.message });
        res.json({ message: "Vote cast successfully" });
      }
    );
  });
});

/* ----------------- RESULTS ----------------- */
// View results
app.get("/api/results", (req, res) => {
  const query = `
    SELECT c.name, c.party, COUNT(v.id) as vote_count
    FROM candidates c
    LEFT JOIN votes v ON c.id = v.candidate_id
    GROUP BY c.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.json({ error: err.message });
    res.json({ results: rows });
  });
});

/* ----------------- SERVER ----------------- */
const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
