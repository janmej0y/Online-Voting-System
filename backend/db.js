const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database file path
const dbPath = path.resolve(__dirname, "voting.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Error opening database:", err.message);
  } else {
    console.log("✅ Connected to SQLite database");
  }
});

// Create tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  // Candidates table
  db.run(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      party TEXT NOT NULL,
      symbol TEXT
    )
  `);

  // Votes table
  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )
  `);

  // Insert default candidates if not exist
  db.all("SELECT * FROM candidates", [], (err, rows) => {
    if (err) {
      console.error("❌ Error fetching candidates:", err.message);
      return;
    }

    if (rows.length === 0) {
      const stmt = db.prepare(
        "INSERT INTO candidates (name, party, symbol) VALUES (?, ?, ?)"
      );
      stmt.run("Narendra Modi", "BJP", "/images/bjp.jpg");
      stmt.run("Rahul Gandhi", "Congress", "/images/cong.png");
      stmt.run("Mamata Banerjee", "TMC", "/images/tmclogo.png");
      stmt.finalize();
      console.log("✅ Default candidates inserted");
    }
  });
});

module.exports = db;
