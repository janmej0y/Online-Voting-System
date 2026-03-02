module.exports = {
  id: "003_feature_pack",
  name: "Feature pack schema upgrades",
  async up({ run, all }) {
    const electionCols = await all("PRAGMA table_info(elections)");
    if (!electionCols.some((c) => c.name === "is_archived")) {
      await run("ALTER TABLE elections ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0");
    }

    const candidateCols = await all("PRAGMA table_info(candidates)");
    if (!candidateCols.some((c) => c.name === "bio")) {
      await run("ALTER TABLE candidates ADD COLUMN bio TEXT");
    }
    if (!candidateCols.some((c) => c.name === "manifesto_url")) {
      await run("ALTER TABLE candidates ADD COLUMN manifesto_url TEXT");
    }

    await run(`
      CREATE TABLE IF NOT EXISTS admin_activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS broadcast_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await run("CREATE INDEX IF NOT EXISTS ix_elections_archived_status ON elections(is_archived, status)");
    await run("CREATE INDEX IF NOT EXISTS ix_activity_created_at ON admin_activity_logs(created_at)");
    await run("CREATE INDEX IF NOT EXISTS ix_votes_election_created ON votes(election_id, created_at)");
  }
};
