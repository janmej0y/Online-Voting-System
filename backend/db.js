// backend/db.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Create DB file
const dbPath = path.resolve(__dirname, "voting.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ Error opening DB:", err.message);
  else console.log("✅ Connected to SQLite database:", dbPath);
});

// Create tables
db.serialize(() => {

  // USERS TABLE (Google Login Only)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      google_id TEXT UNIQUE,
      profile_photo TEXT
    );
  `);

  // CANDIDATES TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      party TEXT NOT NULL,
      image TEXT
    );
  `);

  // VOTES TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    );
  `);

  // Insert default candidates ONCE
  db.get("SELECT COUNT(*) AS c FROM candidates", (err, row) => {
    if (err) return console.error("DB error:", err.message);

    if (row.c === 0) {
      const stmt = db.prepare(
        "INSERT INTO candidates (name, party, image) VALUES (?,?,?)"
      );

      stmt.run("Narendra Modi", "BJP", "bjp.jpg");
      stmt.run("Rahul Gandhi", "Congress", "cong.png");
      stmt.run("Mamata Banerjee", "TMC", "tmclogo.png");

      stmt.finalize(() =>
        console.log("⚡ Default candidates successfully inserted")
      );
    }
  });
});

module.exports = db;
