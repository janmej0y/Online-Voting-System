const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.resolve(__dirname, "voting.db");
const migrationsDir = path.join(__dirname, "migrations");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Error opening DB:", err.message);
  else console.log("Connected to SQLite database:", dbPath);
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function transaction(work) {
  await run("BEGIN IMMEDIATE");
  try {
    const result = await work();
    await run("COMMIT");
    return result;
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }
}

async function runMigrations() {
  await exec("PRAGMA foreign_keys = ON;");
  await run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".js"))
    .sort();

  for (const file of files) {
    const migrationPath = path.join(migrationsDir, file);
    delete require.cache[require.resolve(migrationPath)];
    const migration = require(migrationPath);

    if (!migration || !migration.id || typeof migration.up !== "function") {
      throw new Error(`Invalid migration file: ${file}`);
    }

    const applied = await get("SELECT 1 FROM schema_migrations WHERE id = ?", [migration.id]);
    if (applied) continue;

    await migration.up({ run, get, all, exec, transaction });
    await run("INSERT INTO schema_migrations (id, name) VALUES (?, ?)", [
      migration.id,
      migration.name || migration.id
    ]);

    console.log(`Applied migration ${migration.id}`);
  }
}

const ready = runMigrations();

module.exports = {
  db,
  run,
  get,
  all,
  exec,
  transaction,
  ready
};
