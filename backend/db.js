
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'voting.db'));

function init() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      party TEXT,
      avatar_url TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      candidate_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(candidate_id) REFERENCES candidates(id)
    )`);

    // Seed default candidates if table is empty
    db.get(`SELECT COUNT(*) as count FROM candidates`, (err, row) => {
      if (err) {
        console.error('Error counting candidates:', err.message);
        return;
      }
      if (row.count === 0) {
        const stmt = db.prepare(`INSERT INTO candidates (name, party, avatar_url) VALUES (?, ?, ?)`);
        const defaults = [
          ['Aarav Gupta', 'Forward Party', 'https://picsum.photos/seed/aarav/200'],
          ['Diya Sharma', 'Unity Alliance', 'https://picsum.photos/seed/diya/200'],
          ['Kabir Iyer', 'Green Future', 'https://picsum.photos/seed/kabir/200']
        ];
        defaults.forEach(([n, p, a]) => stmt.run(n, p, a));
        stmt.finalize();
        console.log('Seeded default candidates.');
      }
    });
  });
}

module.exports = { db, init };
