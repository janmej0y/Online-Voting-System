module.exports = {
  id: "001_core_schema",
  name: "Core schema for elections, candidates, users, and votes",
  async up({ run, get }) {
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        google_id TEXT UNIQUE,
        profile_photo TEXT,
        is_admin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        party TEXT NOT NULL,
        image TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS elections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','closed')),
        starts_at TEXT,
        ends_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS election_candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        election_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        UNIQUE(election_id, candidate_id),
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        election_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, election_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
      );
    `);

    await run("CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users(email);");
    await run("CREATE UNIQUE INDEX IF NOT EXISTS ux_users_google_id ON users(google_id);");

    const candidateCount = await get("SELECT COUNT(*) AS c FROM candidates");
    if (!candidateCount || candidateCount.c === 0) {
      await run("INSERT INTO candidates (name, party, image) VALUES (?, ?, ?)", [
        "Narendra Modi",
        "BJP",
        "bjp.jpg"
      ]);
      await run("INSERT INTO candidates (name, party, image) VALUES (?, ?, ?)", [
        "Rahul Gandhi",
        "Congress",
        "cong.png"
      ]);
      await run("INSERT INTO candidates (name, party, image) VALUES (?, ?, ?)", [
        "Mamata Banerjee",
        "TMC",
        "tmclogo.png"
      ]);
    }

    let election = await get("SELECT id FROM elections WHERE status = 'active' ORDER BY id LIMIT 1");
    if (!election) {
      election = await get("SELECT id FROM elections ORDER BY id LIMIT 1");
    }

    let electionId = election ? election.id : null;
    if (!electionId) {
      const created = await run(
        "INSERT INTO elections (title, description, status, starts_at) VALUES (?, ?, 'active', CURRENT_TIMESTAMP)",
        ["General Election", "Default election created automatically"]
      );
      electionId = created.lastID;
    }

    await run(`
      INSERT OR IGNORE INTO election_candidates (election_id, candidate_id)
      SELECT ?, id FROM candidates
    `, [electionId]);
  }
};
