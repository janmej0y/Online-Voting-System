function hasColumn(columns, name) {
  return columns.some((col) => col.name === name);
}

module.exports = {
  id: "004_profile_verification",
  name: "Add profile verification columns for voter onboarding",
  async up({ run, all }) {
    const userCols = await all("PRAGMA table_info(users)");

    if (!hasColumn(userCols, "phone")) {
      await run("ALTER TABLE users ADD COLUMN phone TEXT");
    }
    if (!hasColumn(userCols, "date_of_birth")) {
      await run("ALTER TABLE users ADD COLUMN date_of_birth TEXT");
    }
    if (!hasColumn(userCols, "gender")) {
      await run("ALTER TABLE users ADD COLUMN gender TEXT");
    }
    if (!hasColumn(userCols, "address_line1")) {
      await run("ALTER TABLE users ADD COLUMN address_line1 TEXT");
    }
    if (!hasColumn(userCols, "city")) {
      await run("ALTER TABLE users ADD COLUMN city TEXT");
    }
    if (!hasColumn(userCols, "state_name")) {
      await run("ALTER TABLE users ADD COLUMN state_name TEXT");
    }
    if (!hasColumn(userCols, "postal_code")) {
      await run("ALTER TABLE users ADD COLUMN postal_code TEXT");
    }
    if (!hasColumn(userCols, "voter_card_number")) {
      await run("ALTER TABLE users ADD COLUMN voter_card_number TEXT");
    }
    if (!hasColumn(userCols, "aadhaar_number")) {
      await run("ALTER TABLE users ADD COLUMN aadhaar_number TEXT");
    }
    if (!hasColumn(userCols, "verification_photo")) {
      await run("ALTER TABLE users ADD COLUMN verification_photo TEXT");
    }
    if (!hasColumn(userCols, "profile_completed_at")) {
      await run("ALTER TABLE users ADD COLUMN profile_completed_at TEXT");
    }

    await run("CREATE INDEX IF NOT EXISTS ix_users_voter_card ON users(voter_card_number)");
    await run("CREATE INDEX IF NOT EXISTS ix_users_aadhaar ON users(aadhaar_number)");
    await run(
      "CREATE UNIQUE INDEX IF NOT EXISTS ux_users_voter_card_non_null ON users(voter_card_number) WHERE voter_card_number IS NOT NULL"
    );
    await run(
      "CREATE UNIQUE INDEX IF NOT EXISTS ux_users_aadhaar_non_null ON users(aadhaar_number) WHERE aadhaar_number IS NOT NULL"
    );
  }
};
