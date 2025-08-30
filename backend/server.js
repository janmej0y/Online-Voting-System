
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { db, init } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

// Initialize and serve frontend
init();
app.use('/', express.static(path.join(__dirname, '../frontend')));

// Helpers
function authRequired(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Routes
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  // Check existing user
  db.get(`SELECT id FROM users WHERE email = ?`, [email], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row) return res.status(409).json({ error: 'Account already exists. Please login.' });
    const password_hash = bcrypt.hashSync(password, 10);
    db.run(`INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`,
      [name, email, password_hash],
      function (err2) {
        if (err2) return res.status(500).json({ error: 'Failed to create user' });
        return res.json({ success: true, userId: this.lastID });
      });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, name: user.name, email: user.email });
  });
});

app.get('/api/me', authRequired, (req, res) => {
  db.get(`SELECT id, name, email, created_at FROM users WHERE id = ?`, [req.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(row);
  });
});

app.get('/api/status', authRequired, (req, res) => {
  db.get(`SELECT candidate_id FROM votes WHERE user_id = ?`, [req.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ hasVoted: !!row, candidateId: row ? row.candidate_id : null });
  });
});

app.get('/api/candidates', (req, res) => {
  db.all(`SELECT * FROM candidates`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.post('/api/vote', authRequired, (req, res) => {
  const { candidateId } = req.body || {};
  if (!candidateId) return res.status(400).json({ error: 'candidateId is required' });

  db.get(`SELECT id FROM votes WHERE user_id = ?`, [req.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row) return res.status(409).json({ error: 'You have already voted.' });

    db.run(`INSERT INTO votes (user_id, candidate_id) VALUES (?, ?)`,
      [req.userId, candidateId],
      function (err2) {
        if (err2) return res.status(500).json({ error: 'Failed to record vote' });
        res.json({ success: true, voteId: this.lastID });
      });
  });
});

app.get('/api/results', (req, res) => {
  db.all(`
    SELECT c.id, c.name, c.party, c.avatar_url, 
           COUNT(v.id) AS votes
    FROM candidates c
    LEFT JOIN votes v ON v.candidate_id = c.id
    GROUP BY c.id
    ORDER BY votes DESC, c.name ASC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// Fallback to index.html for SPA-like routing (optional)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
