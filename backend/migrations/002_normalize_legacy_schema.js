async function ensureDefaultElectionId(run, get) {
  let election = await get("SELECT id FROM elections WHERE status = 'active' ORDER BY id LIMIT 1");
  if (election) return election.id;

  election = await get("SELECT id FROM elections ORDER BY id LIMIT 1");
  if (election) return election.id;

  const created = await run(
    "INSERT INTO elections (title, description, status, starts_at) VALUES (?, ?, 'active', CURRENT_TIMESTAMP)",
    ["General Election", "Default election created automatically"]
  );

  return created.lastID;
}

function hasColumn(columns, name) {
  return columns.some((col) => col.name === name);
}

module.exports = {
  id: "002_normalize_legacy_schema",
  name: "Normalize legacy schema and enforce vote uniqueness per election",
  async up({ run, get, all, transaction }) {
    const userColumns = await all("PRAGMA table_info(users)");

    if (!hasColumn(userColumns, "profile_photo")) {
      await run("ALTER TABLE users ADD COLUMN profile_photo TEXT");
    }
    if (!hasColumn(userColumns, "google_id")) {
      await run("ALTER TABLE users ADD COLUMN google_id TEXT");
    }
    if (!hasColumn(userColumns, "is_admin")) {
      await run("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
    }
    if (!hasColumn(userColumns, "created_at")) {
      await run("ALTER TABLE users ADD COLUMN created_at TEXT");
      await run("UPDATE users SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)");
    }

    await run("CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users(email)");
    await run("CREATE UNIQUE INDEX IF NOT EXISTS ux_users_google_id ON users(google_id)");

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
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS election_candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        election_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        UNIQUE(election_id, candidate_id),
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      )
    `);

    const defaultElectionId = await ensureDefaultElectionId(run, get);

    const voteColumns = await all("PRAGMA table_info(votes)");
    if (voteColumns.length === 0) {
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
        )
      `);
    } else {
      const hasElectionId = hasColumn(voteColumns, "election_id");
      const hasCreatedAt = hasColumn(voteColumns, "created_at");

      const indexList = await all("PRAGMA index_list(votes)");
      let hasUserElectionUnique = false;

      for (const idx of indexList.filter((entry) => entry.unique === 1)) {
        const cols = await all(`PRAGMA index_info(${JSON.stringify(idx.name)})`);
        const colNames = cols.map((c) => c.name);
        if (colNames.length === 2 && colNames[0] === "user_id" && colNames[1] === "election_id") {
          hasUserElectionUnique = true;
          break;
        }
      }

      if (!hasElectionId || !hasCreatedAt || !hasUserElectionUnique) {
        await transaction(async () => {
          await run("ALTER TABLE votes RENAME TO votes_legacy");

          await run(`
            CREATE TABLE votes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              candidate_id INTEGER NOT NULL,
              election_id INTEGER NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, election_id),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
              FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
            )
          `);

          const legacyCols = await all("PRAGMA table_info(votes_legacy)");
          const legacyHasElectionId = hasColumn(legacyCols, "election_id");
          const legacyHasCreatedAt = hasColumn(legacyCols, "created_at");

          const electionExpr = legacyHasElectionId
            ? `COALESCE(election_id, ${defaultElectionId})`
            : `${defaultElectionId}`;

          const createdAtExpr = legacyHasCreatedAt
            ? "COALESCE(created_at, CURRENT_TIMESTAMP)"
            : "CURRENT_TIMESTAMP";

          await run(`
            INSERT INTO votes (user_id, candidate_id, election_id, created_at)
            SELECT user_id, candidate_id, election_id, created_at
            FROM (
              SELECT
                user_id,
                candidate_id,
                ${electionExpr} AS election_id,
                ${createdAtExpr} AS created_at,
                ROW_NUMBER() OVER (
                  PARTITION BY user_id, ${electionExpr}
                  ORDER BY id ASC
                ) AS rn
              FROM votes_legacy
            ) deduped
            WHERE rn = 1
          `);

          await run("DROP TABLE votes_legacy");
        });
      }
    }

    await run(`
      INSERT OR IGNORE INTO election_candidates (election_id, candidate_id)
      SELECT ?, id FROM candidates
    `, [defaultElectionId]);
  }
};
