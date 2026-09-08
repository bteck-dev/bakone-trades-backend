require("dotenv/config");
const { existsSync, readdirSync, readFileSync } = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const migrationsDir = path.resolve(__dirname, "../migrations");
if (!dbUrl) { console.error("[migrate] Missing SUPABASE_DB_URL or DATABASE_URL."); process.exit(1); }
if (!existsSync(migrationsDir)) { console.error(`[migrate] Migration directory not found: ${migrationsDir}`); process.exit(1); }

const runPsql = (sql) => spawnSync("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"], {
  input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"], shell: process.platform === "win32",
});

let result = runPsql("create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());");
if (result.error) {
  console.error("[migrate] Could not run psql. Install PostgreSQL client tools and ensure psql is on PATH.");
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);

for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
  const safeName = file.replace(/'/g, "''");
  result = runPsql(`select exists(select 1 from public.schema_migrations where name = '${safeName}');`);
  if (result.status !== 0) process.exit(result.status || 1);
  if (result.stdout.trim() === "t") { console.log(`[migrate] Already applied: ${file}`); continue; }

  const sql = readFileSync(path.join(migrationsDir, file), "utf8");
  result = runPsql(`begin;\n${sql}\ninsert into public.schema_migrations(name) values ('${safeName}');\ncommit;`);
  if (result.status !== 0) process.exit(result.status || 1);
  console.log(`[migrate] Applied: ${file}`);
}
console.log("[migrate] Database is up to date.");
