/**
 * Break-glass administrator recovery — SHELL ONLY. There is deliberately no web page or API that
 * does any of this: whoever can run this script already controls the server, the database and the
 * .env, so it adds no new way in. Every action is written to the audit log and raises a Security
 * Center alert that is emailed to the Super Admins and the security alert address.
 *
 *   npm run security:recovery -- status     <email>   2FA on/off, lock state, active sessions
 *   npm run security:recovery -- unlock     <email>   clear password + 2FA lockouts and OTP throttles
 *   npm run security:recovery -- reset-2fa  <email>   remove the authenticator + backup codes, sign out everywhere
 *   npm run security:recovery -- login-link <email>   one-time sign-in link (single use, 15 minutes)
 *
 *   (or: npx tsx scripts/admin-recovery.ts <command> <email>)
 *
 * Audit rows are written as "System" (there is no signed-in user) and name the shell account
 * that ran the script.
 *
 * Nothing secret is printed: no password, no code, no authenticator secret, no session token.
 * The one exception is the recovery URL itself, which IS a credential — open it yourself, or hand
 * it over in person / by phone. Never paste it into a ticket, chat or email thread.
 */
import "dotenv/config";
import os from "node:os";
import path from "node:path";
import { db } from "../src/lib/db";
import { audit } from "../src/lib/audit";
import { absoluteUrl } from "../src/lib/utils";
import { isEncryptionConfigured } from "../src/lib/crypto";
import { hashedRateKey } from "../src/lib/rate-limit";
import { maskIp, deviceLabel } from "../src/lib/auth/device";
import { adminIdleMinutes, adminPasswordLoginEnabled, adminTwoFactorRequired } from "../src/lib/auth/policy";
import { revokeAllSessions } from "../src/lib/auth/session";
import { isEmailConfigured, sendSecurityEmail } from "../src/lib/notifications";
import { createRecoveryLink } from "../src/server/admin-auth";
import { istTime, raiseSecurityAlert } from "../src/server/security-alerts";

const COMMANDS = ["status", "unlock", "reset-2fa", "login-link"] as const;
type Command = (typeof COMMANDS)[number];

function usage(exitCode = 1): never {
  console.log(
    [
      "Usage: npm run security:recovery -- <command> <email>",
      "",
      "  status     <email>   Show 2FA, lock state and active sessions (no secrets).",
      "  unlock     <email>   Clear password and 2FA lockouts and the email-code throttle.",
      "  reset-2fa  <email>   Remove the authenticator and backup codes; sign out every session.",
      "  login-link <email>   Print a one-time sign-in link (single use, valid 15 minutes).",
    ].join("\n")
  );
  process.exit(exitCode);
}

/** Who ran the script, for the audit log and the alert ("shell: deploy@vps-1"). */
function issuer(): string {
  let who = "unknown";
  try {
    who = os.userInfo().username;
  } catch {
    /* some containers have no passwd entry */
  }
  return `server shell (${who}@${os.hostname()})`;
}

async function findAdmin(email: string) {
  const user = await db.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" }, role: { in: ["SUPER_ADMIN", "STAFF"] }, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      failedLoginCount: true,
      lockedUntil: true,
      totpEnabledAt: true,
      mfaFailedCount: true,
      mfaLockedUntil: true,
    },
  });
  if (!user) {
    console.error(`No administrator account (Super Admin or Foundation Staff) has the email ${email}.`);
    process.exit(2);
  }
  return user;
}

function when(d: Date | null | undefined): string {
  return d ? istTime(d) : "—";
}

/**
 * raiseSecurityAlert() emails the Super Admins in the background (it never blocks a web request).
 * A CLI that disconnects straight away would cut those emails off, so wait until every email row
 * queued since `since` has left PENDING (max 30 s).
 */
async function settleOutgoingEmail(since: Date) {
  await new Promise((r) => setTimeout(r, 1500));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const pending = await db.notification.count({ where: { channel: "EMAIL", status: "PENDING", createdAt: { gte: since } } });
    if (pending === 0) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn("Some alert emails were still sending after 30 s; check Admin → Notifications → Log.");
}

async function status(email: string) {
  const u = await findAdmin(email);
  const now = new Date();
  const [backupCodes, sessions, emailReady, twoFaRequired] = await Promise.all([
    db.twoFactorBackupCode.count({ where: { userId: u.id, usedAt: null } }),
    db.session.findMany({
      where: { userId: u.id, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastSeenAt: "desc" },
      select: { createdAt: true, lastSeenAt: true, ip: true, userAgent: true, authMethod: true, mfaAt: true },
    }),
    isEmailConfigured(),
    adminTwoFactorRequired(),
  ]);
  const idleMs = adminIdleMinutes() * 60_000;
  const live = sessions.filter((s) => now.getTime() - s.lastSeenAt.getTime() < idleMs);
  const passwordLocked = !!u.lockedUntil && u.lockedUntil > now;
  const mfaLocked = !!u.mfaLockedUntil && u.mfaLockedUntil > now;

  console.log(`\n${u.name} <${u.email}>`);
  console.log(`  Role                 ${u.role === "SUPER_ADMIN" ? "Super Admin" : "Foundation Staff"}`);
  console.log(`  Account status       ${u.status}`);
  console.log(`  Last sign-in         ${when(u.lastLoginAt)}`);
  console.log(`  Authenticator (2FA)  ${u.totpEnabledAt ? `ON since ${when(u.totpEnabledAt)}` : "OFF"}`);
  console.log(`  Unused backup codes  ${u.totpEnabledAt ? backupCodes : "—"}`);
  console.log(`  Password sign-in     ${passwordLocked ? `LOCKED until ${when(u.lockedUntil)}` : "not locked"} (${u.failedLoginCount} recent wrong password(s))`);
  console.log(`  2FA codes            ${mfaLocked ? `LOCKED until ${when(u.mfaLockedUntil)}` : "not locked"} (${u.mfaFailedCount} recent wrong code(s))`);
  console.log(`  Active sessions      ${live.length} in use, ${sessions.length - live.length} idle past ${adminIdleMinutes()} min (signed out on next request)`);
  for (const s of live) {
    console.log(`    · ${deviceLabel(s.userAgent)} · IP ${maskIp(s.ip)} · ${s.authMethod ?? "PASSWORD"}${s.mfaAt ? " + 2FA" : ""} · signed in ${when(s.createdAt)} · last seen ${when(s.lastSeenAt)}`);
  }
  console.log("\nServer policy");
  console.log(`  Password sign-in for admins  ${adminPasswordLoginEnabled() ? "on" : "off (email code only)"}   [ADMIN_PASSWORD_LOGIN]`);
  console.log(`  2FA required for all admins  ${twoFaRequired ? "yes" : "no"}   [Settings → Security]`);
  console.log(`  DATA_ENCRYPTION_KEY          ${isEncryptionConfigured() ? "configured" : "MISSING — 2FA cannot be set up"}`);
  console.log(`  SMTP (sign-in codes)         ${emailReady ? "configured" : "NOT configured — email codes cannot be delivered"}`);
}

async function unlock(email: string) {
  const u = await findAdmin(email);
  const since = new Date();
  await db.user.update({ where: { id: u.id }, data: { failedLoginCount: 0, lockedUntil: null, mfaFailedCount: 0, mfaLockedUntil: null } });
  // The per-address email-code throttle (src/server/admin-auth.ts) — so a fresh code can be requested now.
  const throttles = u.email
    ? await db.rateLimit.deleteMany({ where: { key: { in: [hashedRateKey("admin-otp:email", u.email), hashedRateKey("admin-otp:abuse-alert", u.email)] } } })
    : { count: 0 };
  const by = issuer();
  await audit({
    action: "unlock",
    module: "security",
    recordType: "User",
    recordId: u.id,
    description: `Sign-in for ${u.name} was unlocked from the ${by}`,
    oldValue: { failedLoginCount: u.failedLoginCount, lockedUntil: u.lockedUntil, mfaFailedCount: u.mfaFailedCount, mfaLockedUntil: u.mfaLockedUntil },
    newValue: { failedLoginCount: 0, lockedUntil: null, mfaFailedCount: 0, mfaLockedUntil: null, emailCodeThrottleCleared: throttles.count > 0 },
  });
  await raiseSecurityAlert({ type: "ACCOUNT_UNLOCKED", severity: "warning", title: `Sign-in for ${u.name} was unlocked from the server`, detail: `Unlocked by the recovery script: ${by}.`, userId: u.id });
  await settleOutgoingEmail(since);
  console.log(`Unlocked ${u.name} <${u.email}>: password and 2FA lockouts cleared${throttles.count ? ", email-code throttle reset" : ""}.`);
  if (u.status !== "ACTIVE") console.log(`Note: the account itself is ${u.status}. Re-enable it in Admin → Security Center → Administrators.`);
}

async function resetTwoFactor(email: string) {
  const u = await findAdmin(email);
  const since = new Date();
  const by = issuer();
  // Implemented here rather than with resetTwoFactorFor(), which needs a signed-in Super Admin and
  // refuses a Super Admin resetting themself — exactly the person who usually needs this.
  await db.$transaction(async (tx) => {
    await tx.twoFactorBackupCode.deleteMany({ where: { userId: u.id } });
    await tx.user.update({
      where: { id: u.id },
      data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, totpPendingSecretEnc: null, totpPendingAt: null, mfaFailedCount: 0, mfaLockedUntil: null },
    });
  });
  const revoked = await revokeAllSessions(u.id);
  await audit({
    action: "2fa_reset",
    module: "security",
    recordType: "User",
    recordId: u.id,
    description: `Two-factor authentication for ${u.name} was reset from the ${by}; ${revoked} session(s) signed out`,
    oldValue: { twoFactorEnabled: !!u.totpEnabledAt },
    newValue: { twoFactorEnabled: false, sessionsRevoked: revoked },
  });
  if (u.email) await sendSecurityEmail({ userId: u.id, email: u.email, event: "TWO_FACTOR_RESET", data: { name: u.name, actor: "The server recovery script", time: istTime() } });
  await raiseSecurityAlert({
    type: "TWO_FACTOR_RESET",
    severity: "critical",
    title: `Two-factor authentication for ${u.name} was reset from the server`,
    detail: `Reset by the recovery script: ${by}. ${revoked} session(s) were signed out. If nobody on the team did this, the server itself may be compromised.`,
    userId: u.id,
  });
  await settleOutgoingEmail(since);
  console.log(`Two-factor authentication removed for ${u.name} <${u.email}>; ${revoked} session(s) signed out.`);
  console.log(
    (await adminTwoFactorRequired())
      ? "2FA is required for administrators, so they will set up a new authenticator at their next sign-in."
      : "They can sign in with the email code and set up a new authenticator in My Account → Security."
  );
}

async function loginLink(email: string) {
  const u = await findAdmin(email);
  if (u.status !== "ACTIVE") {
    console.error(`${u.name}'s account is ${u.status}. A recovery link is only issued for an active administrator.`);
    process.exit(2);
  }
  const since = new Date();
  const { token, expiresAt } = await createRecoveryLink(u.id, issuer());
  const url = absoluteUrl(`/login/admin/recover?token=${encodeURIComponent(token)}`);
  await settleOutgoingEmail(since);
  console.log(`\nOne-time recovery sign-in link for ${u.name} <${u.email}>:\n\n  ${url}\n`);
  console.log(`  · SINGLE USE, and it expires in 15 minutes (${istTime(expiresAt)}).`);
  console.log("  · It signs in as this administrator with every check satisfied — treat it like a password.");
  console.log("  · Open it yourself, or give it over in person / by phone. Do not paste it into email, chat or a ticket.");
  console.log("  · The Super Admins and the security alert address have been alerted.");
  if (!url.startsWith("https://")) {
    console.log(`\n  WARNING: APP_URL is ${process.env.APP_URL ? `"${process.env.APP_URL}"` : "not set"}, so this link is not https. On the live server set APP_URL to the public https address (e.g. https://eduskillindia.org/center).`);
  }
}

async function main() {
  const [cmd, email] = process.argv.slice(2);
  if (cmd === "-h" || cmd === "--help") usage(0);
  if (!cmd || !(COMMANDS as readonly string[]).includes(cmd) || !email || !email.includes("@")) usage();
  switch (cmd as Command) {
    case "status":
      return status(email);
    case "unlock":
      return unlock(email);
    case "reset-2fa":
      return resetTwoFactor(email);
    case "login-link":
      return loginLink(email);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "admin-recovery.ts"))) {
  main()
    .then(async () => {
      await db.$disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err instanceof Error ? err.message : err);
      await db.$disconnect();
      process.exit(1);
    });
}
