require("dotenv/config");

const { existsSync } = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const migrationFile = path.resolve(__dirname, "../SUPABASE_SCHEMA.sql");

if (!dbUrl) {
  console.error("[migrate] Missing database connection string.");
  console.error("[migrate] Add SUPABASE_DB_URL or DATABASE_URL to your .env.");
  console.error("[migrate] You can find it in Supabase Dashboard > Project Settings > Database > Connection string.");
  process.exit(1);
}

if (!existsSync(migrationFile)) {
  console.error(`[migrate] Migration file not found: ${migrationFile}`);
  process.exit(1);
}

const result = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", migrationFile], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("[migrate] Failed to run psql.");
  console.error("[migrate] Install PostgreSQL tools, then make sure psql is available in your PATH.");
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`[migrate] Failed with exit code ${result.status}`);
  process.exit(result.status || 1);
}

console.log("[migrate] Done");
