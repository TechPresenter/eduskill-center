/**
 * Vitest global setup: creates an isolated `<db>_test` database on the same PostgreSQL server,
 * applies migrations and truncates all tables so every run starts from a clean slate.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import pg from "pg";
import { testDatabaseUrl } from "./db-url";

export async function setup() {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL must be set (see .env.example)");
  const testUrl = testDatabaseUrl(base);
  const dbName = new URL(testUrl).pathname.slice(1);

  const maintenance = new URL(base);
  maintenance.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: maintenance.toString() });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: testUrl }, stdio: "pipe" });

  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  const tables = await client.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'");
  if (tables.rows.length) {
    await client.query(`TRUNCATE ${tables.rows.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
  await client.end();
}
