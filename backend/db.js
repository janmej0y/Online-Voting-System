
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database file
const dbPath = path.resolve(__dirname, "voting.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Database error:", err.message);
  } else {
    console.log("✅ Connected to SQLite database");
  }
});

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      party TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id),
      UNIQUE(user_id)
    )
  `);

  // Insert sample candidates if none exist
  db.all("SELECT COUNT(*) as count FROM candidates", (err, rows) => {
    if (rows[0].count === 0) {
      const stmt = db.prepare("INSERT INTO candidates (name, party) VALUES (?, ?)");
      stmt.run("Alice Johnson", "Party A");
      stmt.run("Bob Smith", "Party B");
      stmt.run("Charlie Brown", "Party C");
      stmt.finalize();
      console.log("✅ Inserted sample candidates");
    }
  });
});

module.exports = db;
