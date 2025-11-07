// backend/db.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "voting.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ DB open error:", err.message);
  else console.log("✅ Connected to SQLite database");
});

db.serialize(() => {
  // Users table with OTP + verification + photo
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      otp_code TEXT,
      otp_expires INTEGER,
      profile_photo TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      party TEXT NOT NULL,
      image TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )
  `);

  db.get("SELECT COUNT(*) as c FROM candidates", (e, r) => {
    if (e) return console.error(e.message);
    if (r.c === 0) {
      const s = db.prepare("INSERT INTO candidates (name, party, image) VALUES (?,?,?)");
      s.run("Narendra Modi", "BJP", "bjp.jpg");
      s.run("Rahul Gandhi", "Congress", "cong.png");
      s.run("Mamata Banerjee", "TMC", "tmclogo.png");
      s.finalize();
      console.log("✅ Default candidates inserted");
    }
  });
});

module.exports = db;
