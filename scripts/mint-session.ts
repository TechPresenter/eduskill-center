/**
 * LOCAL TESTING ONLY. Mints a signed-in session for any account of the local development database
 * — with the second factor marked as satisfied — and prints the cookie, so `scripts/smoke.ts` and
 * `scripts/screenshot.ts` can reach the admin area now that administrators sign in with an email
 * code and an authenticator app.
 *
 *   npx tsx scripts/mint-session.ts <email>
 *   SHOT_COOKIE="$(npx tsx scripts/mint-session.ts info@eduskillindia.com)" npx tsx scripts/screenshot.ts http://localhost:3000 /admin/dashboard
 *   SMOKE_ADMIN_COOKIE="$(npx tsx scripts/mint-session.ts info@eduskillindia.com)" npx tsx scripts/smoke.ts
 *
 * Only the cookie (`esk_session=<token>`) goes to stdout; everything else goes to stderr, so the
 * command can be used inside `$(…)`.
 *
 * Refuses to run when NODE_ENV=production or when DATABASE_URL points anywhere but this machine
 * (localhost / 127.0.0.1 / ::1). There is no override: on a real server use the Secure Admin Login,
 * or `npm run security:recovery -- login-link <email>` when locked out.
 */
import "dotenv/config";
import path from "node:path";
import { db } from "../src/lib/db";
import { audit } from "../src/lib/audit";
import { createSession, SESSION_COOKIE } from "../src/lib/auth/session";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function refuseUnlessLocal() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run: NODE_ENV=production. This script is for local testing only.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  if (!LOCAL_HOSTS.has(host)) throw new Error(`Refusing to run against a non-local database (${host}). This script is for local testing only.`);
}

async function main() {
  refuseUnlessLocal();
  const email = process.argv[2]?.trim();
  if (!email || !email.includes("@")) {
    console.error("Usage: npx tsx scripts/mint-session.ts <email>");
    process.exit(1);
  }
  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    select: { id: true, name: true, role: true, status: true },
  });
  if (!user) throw new Error(`No account has the email ${email}`);
  if (user.status !== "ACTIVE") throw new Error(`${user.name}'s account is ${user.status}`);
  const session = await createSession(user.id, { role: user.role, authMethod: "RECOVERY", mfa: true, ip: "127.0.0.1", userAgent: "scripts/mint-session.ts (local testing)" });
  await audit({
    action: "session_minted",
    module: "security",
    recordType: "User",
    recordId: user.id,
    description: `A local test session for ${user.name} was minted by scripts/mint-session.ts`,
  });
  console.error(`Session for ${user.name} (${user.role}) valid until ${session.expiresAt.toISOString()}. Local testing only.`);
  console.log(`${SESSION_COOKIE}=${session.token}`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "mint-session.ts"))) {
  main()
    .then(async () => {
      await db.$disconnect();
    })
    .catch(async (err) => {
      console.error(err instanceof Error ? err.message : err);
      await db.$disconnect();
      process.exit(1);
    });
}
