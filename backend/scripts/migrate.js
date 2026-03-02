const path = require("path");
const dbModule = require(path.join(__dirname, "..", "db"));

async function main() {
  await dbModule.ready;
  console.log("Migrations completed successfully.");
  dbModule.db.close();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
  dbModule.db.close();
});
