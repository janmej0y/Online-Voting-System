module.exports = {
  id: "007_feedback_module",
  name: "Add public feedback module",
  async up({ run }) {
    await run(`
      CREATE TABLE IF NOT EXISTS public_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed','closed')),
        admin_note TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    await run("CREATE INDEX IF NOT EXISTS ix_feedback_status_created ON public_feedback(status, created_at)");
  }
};
