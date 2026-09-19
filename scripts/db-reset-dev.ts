/**
 * Empties every table of the LOCAL development database and re-runs the seed.
 * Refuses to run unless DATABASE_URL points at localhost (never use against production).
 *   npm run db:reset
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) throw new Error(`Refusing to reset a non-local database (${host})`);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const tables = await client.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'");
  if (tables.rows.length) {
    await client.query(`TRUNCATE ${tables.rows.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
  await client.end();
  console.log(`[db:reset] emptied ${tables.rows.length} tables`);
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  execSync("npx prisma db seed", { stdio: "inherit" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
