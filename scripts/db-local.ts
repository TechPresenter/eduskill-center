/**
 * Starts a real PostgreSQL server for local development using embedded-postgres.
 * Data is persisted in ./.data/pg (git-ignored). Production deployments should
 * point DATABASE_URL at a managed PostgreSQL instance instead.
 *
 * Usage: npm run db:local
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import fs from "node:fs";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 5433);
const USER = process.env.LOCAL_PG_USER ?? "eduskill";
const PASSWORD = process.env.LOCAL_PG_PASSWORD ?? "eduskill";
const DB_NAME = process.env.LOCAL_PG_DB ?? "eduskill";
const DATA_DIR = path.resolve(process.cwd(), ".data", "pg");

async function main() {
  const firstRun = !fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    // Force UTF-8 so Indian-language text, ₹ and symbols store correctly (Windows defaults to WIN1252).
    initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
    onLog: () => {},
    onError: (e) => console.error(String(e)),
  });

  if (firstRun) {
    console.log(`[db:local] Initialising PostgreSQL cluster in ${DATA_DIR} ...`);
    await pg.initialise();
  }
  console.log(`[db:local] Starting PostgreSQL on port ${PORT} ...`);
  await pg.start();

  if (firstRun) {
    await pg.createDatabase(DB_NAME);
    console.log(`[db:local] Created database "${DB_NAME}".`);
  }

  console.log(
    `[db:local] Ready. DATABASE_URL=postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB_NAME}?schema=public`
  );
  console.log("[db:local] Press Ctrl+C to stop.");

  const shutdown = async () => {
    console.log("\n[db:local] Stopping PostgreSQL ...");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error("[db:local] Failed:", err);
  process.exit(1);
});
