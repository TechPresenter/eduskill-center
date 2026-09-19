import "dotenv/config";
import path from "node:path";
import { testDatabaseUrl } from "./db-url";

// Point the app at the isolated test database before any module imports `@/lib/db`.
process.env.DATABASE_URL = testDatabaseUrl(process.env.DATABASE_URL ?? "postgresql://eduskill:eduskill@localhost:5433/eduskill?schema=public");
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_LOCAL_DIR = path.resolve(process.cwd(), ".data", "test-storage");
process.env.APP_URL = "http://localhost:3000";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-test-secret-test-secret";
