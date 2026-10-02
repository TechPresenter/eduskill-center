import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

// Sign-in codes are captured from the (mocked) security email instead of a real mailbox.
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  sendSecurityEmail: vi.fn(async () => ({ ok: true })),
  isEmailConfigured: vi.fn(async () => true),
}));

import { db } from "@/lib/db";
import { sendSecurityEmail } from "@/lib/notifications";
import { encryptSecret } from "@/lib/crypto";
import { createSession, resolveSessionByToken } from "@/lib/auth/session";
import { adminIdleMs, adminSessionMs } from "@/lib/auth/policy";
import { generateTotpSecret, totpAt, totpStep } from "@/lib/auth/totp";
import { login } from "@/server/auth";
import { replaceBackupCodes } from "@/server/two-factor";
import {
  ADMIN_OTP_MAX_ATTEMPTS,
  ADMIN_OTP_NEUTRAL_MESSAGE,
  adminLoginOptions,
  getAdminChallengeState,
  maskEmail,
  resendAdminEmailOtp,
  startAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminSecondFactor,
} from "@/server/admin-auth";
import { ADMIN_TEST_PASSWORD, makeAdminAccount, randomMobile, uid } from "./helpers";

/**
 * Secure Admin Login (src/server/admin-auth.ts) against the real database: email code, the
 * authenticator step, backup codes, and the administrator session policy in resolveSessionByToken.
 */

const ORIGINAL_KEY = process.env.DATA_ENCRYPTION_KEY;

beforeAll(() => {
  // TOTP secrets are stored encrypted; this key exists only for this file.
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("hex");
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = ORIGINAL_KEY;
});

let seq = 0;
/** A distinct client per sign-in, so the per-IP limits of one test never touch another. */
function newMeta() {
  seq += 1;
  return {
    ip: `10.77.${seq % 250}.${(seq * 7) % 250 + 1}`,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
    deviceId: randomBytes(24).toString("base64url"),
  };
}

const sentEmails = () => vi.mocked(sendSecurityEmail).mock.calls.map(([input]) => input);

/** Starts Secure Admin Login and returns the code from the (mocked) email, if one was sent. */
async function requestCode(email: string, meta = newMeta()) {
  vi.mocked(sendSecurityEmail).mockClear();
  const res = await startAdminEmailOtp({ email, next: "/admin/security", ...meta });
  const mail = sentEmails().find((m) => m.event === "ADMIN_LOGIN_OTP");
  return { ...res, meta, mail, code: mail ? String(mail.data.code) : undefined };
}

/** A six-digit code guaranteed to differ from `code`. */
const wrongCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

/** A six-digit code that is not valid for `secret` anywhere near now. */
function wrongTotp(secret: string) {
  const now = totpStep();
  const valid = new Set([-2, -1, 0, 1, 2].map((d) => totpAt(secret, now + d)));
  for (let n = 0; ; n++) {
    const c = String(n).padStart(6, "0");
    if (!valid.has(c)) return c;
  }
}

async function makeTotpAdmin(role: "SUPER_ADMIN" | "STAFF" = "SUPER_ADMIN") {
  const secret = generateTotpSecret();
  const account = await makeAdminAccount({ role, totpSecretEnc: encryptSecret(secret) });
  return { ...account, secret };
}

/** Email code → verified; for a 2FA administrator the flow stops at the authenticator step. */
async function passEmailStep(email: string) {
  const r = await requestCode(email);
  expect(r.code).toMatch(/^\d{6}$/);
  const step = await verifyAdminEmailOtp(r.challengeToken, r.code!, r.meta);
  return { ...r, step };
}

/** Settles a promise into "ok" or "<status> <message>" so two flows can be compared. */
async function outcome(p: Promise<unknown>) {
  try {
    await p;
    return "ok";
  } catch (err) {
    const e = err as { status?: number; message?: string };
    return `${e.status ?? "?"} ${e.message ?? ""}`;
  }
}

describe("Secure Admin Login — email code", () => {
  it("offers the email code when SMTP is configured", async () => {
    expect(await adminLoginOptions()).toMatchObject({ emailOtp: true });
  });

  it("answers an unknown address like a real one and emails nothing", async () => {
    const unknown = await requestCode(`${uid("nobody")}@admin.test`);
    expect(unknown.message).toBe(ADMIN_OTP_NEUTRAL_MESSAGE);
    expect(unknown.mail).toBeUndefined();
    expect(unknown.challengeToken.length).toBeGreaterThanOrEqual(40);
    expect(unknown.state).toMatchObject({ stage: "OTP", firstFactor: null });

    // A student's address is not an administrator's either.
    const student = await db.user.create({ data: { name: "Student", email: `${uid("stu")}@student.test`, mobile: randomMobile("7"), passwordHash: "unused", role: "STUDENT" } });
    const asStudent = await requestCode(student.email!);
    expect(asStudent.message).toBe(ADMIN_OTP_NEUTRAL_MESSAGE);
    expect(asStudent.mail).toBeUndefined();
    expect(await db.loginOtp.count({ where: { userId: student.id } })).toBe(0);

    const { email } = await makeAdminAccount();
    const real = await requestCode(email);
    expect(real.mail).toBeDefined();
    expect(real.message).toBe(unknown.message);
    expect(Object.keys(real).filter((k) => !["mail", "code", "meta"].includes(k)).sort()).toEqual(Object.keys(unknown).filter((k) => !["mail", "code", "meta"].includes(k)).sort());
    expect(real.state.stage).toBe(unknown.state.stage);
    expect(real.state.firstFactor).toBe(unknown.state.firstFactor);

    // Any code for the unknown address is simply "not correct".
    await expect(verifyAdminEmailOtp(unknown.challengeToken, "123456", unknown.meta)).rejects.toMatchObject({ status: 401 });
  });

  it("emails a real administrator a 6-digit code that is stored only as a keyed hash", async () => {
    const { user, email } = await makeAdminAccount();
    const r = await requestCode(email.toUpperCase());
    expect(r.code).toMatch(/^\d{6}$/);
    expect(r.mail).toMatchObject({ userId: user.id, email, event: "ADMIN_LOGIN_OTP", redact: ["code"] });
    expect(r.state.emailHint).toBe(maskEmail(email));
    expect(r.state.emailHint).not.toBe(email);

    const otp = await db.loginOtp.findFirstOrThrow({ where: { userId: user.id, purpose: "ADMIN_LOGIN" } });
    expect(otp.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(otp.codeHash).not.toContain(r.code!);
    expect(otp.attempts).toBe(0);
    const ch = await db.authChallenge.findFirstOrThrow({ where: { id: otp.challengeId! } });
    expect(ch.tokenHash).not.toBe(r.challengeToken);
    expect(JSON.stringify(ch)).not.toContain(r.code!);
  });

  it(`counts wrong codes and locks the code after ${ADMIN_OTP_MAX_ATTEMPTS} attempts, even against the right code`, async () => {
    const { user, email } = await makeAdminAccount();
    const r = await requestCode(email);
    for (let i = 1; i <= ADMIN_OTP_MAX_ATTEMPTS; i++) {
      await expect(verifyAdminEmailOtp(r.challengeToken, wrongCode(r.code!), r.meta)).rejects.toMatchObject({ status: 401 });
      const otp = await db.loginOtp.findFirstOrThrow({ where: { userId: user.id, purpose: "ADMIN_LOGIN" } });
      expect(otp.attempts).toBe(i);
    }
    await expect(verifyAdminEmailOtp(r.challengeToken, r.code!, r.meta)).rejects.toThrow(/too many wrong attempts/i);
    const otp = await db.loginOtp.findFirstOrThrow({ where: { userId: user.id, purpose: "ADMIN_LOGIN" } });
    expect(otp.consumedAt).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.loginHistory.count({ where: { userId: user.id, success: false, reason: "otp_locked" } })).toBeGreaterThanOrEqual(2);
  });

  it("signs in with the emailed code: a new session, single-use challenge, login recorded", async () => {
    const { user, email } = await makeAdminAccount();
    const r = await requestCode(email);
    const out = await verifyAdminEmailOtp(r.challengeToken, r.code!, r.meta);
    if (out.step !== "done") throw new Error(`expected step "done", got "${out.step}"`);
    expect(out.session.redirect).toBe("/admin/security");

    const session = await resolveSessionByToken(out.session.token);
    expect(session?.id).toBe(user.id);
    expect(session?.role).toBe("SUPER_ADMIN");
    expect(session?.permissions).toEqual(["*"]);
    expect(session?.security).toMatchObject({ authMethod: "EMAIL_OTP", mfa: false, twoFactorEnabled: false, tier: 0 });

    // The challenge and the code are spent.
    await expect(verifyAdminEmailOtp(r.challengeToken, r.code!, r.meta)).rejects.toMatchObject({ status: 401 });
    expect(await getAdminChallengeState(r.challengeToken)).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.emailVerifiedAt).not.toBeNull();
    expect(after.lastLoginAt).not.toBeNull();
    expect(await db.loginHistory.count({ where: { userId: user.id, success: true, method: "EMAIL_OTP" } })).toBe(1);
  });

  it("binds a code to its own challenge: another browser's token cannot use it, nor burn it", async () => {
    const { user, email } = await makeAdminAccount();
    const mine = await requestCode(email);
    // Someone else who knows the address starts their own sign-in for it.
    const theirs = await requestCode(email);
    expect(theirs.code).toMatch(/^\d{6}$/);

    await expect(verifyAdminEmailOtp(theirs.challengeToken, mine.code!, theirs.meta)).rejects.toMatchObject({ status: 401 });
    if (mine.code !== theirs.code) {
      await expect(verifyAdminEmailOtp(mine.challengeToken, theirs.code!, mine.meta)).rejects.toMatchObject({ status: 401 });
    }
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);

    // The administrator's own code still works in the administrator's own browser.
    const out = await verifyAdminEmailOtp(mine.challengeToken, mine.code!, mine.meta);
    expect(out.step).toBe("done");
  });

  it("refuses a missing, malformed or expired challenge token", async () => {
    const { user, email } = await makeAdminAccount();
    const r = await requestCode(email);
    await expect(verifyAdminEmailOtp(null, r.code!, r.meta)).rejects.toMatchObject({ status: 401 });
    await expect(verifyAdminEmailOtp("short", r.code!, r.meta)).rejects.toMatchObject({ status: 401 });
    await expect(verifyAdminEmailOtp(randomBytes(32).toString("base64url"), r.code!, r.meta)).rejects.toMatchObject({ status: 401 });

    const otp = await db.loginOtp.findFirstOrThrow({ where: { userId: user.id, purpose: "ADMIN_LOGIN" } });
    await db.authChallenge.update({ where: { id: otp.challengeId! }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyAdminEmailOtp(r.challengeToken, r.code!, r.meta)).rejects.toThrow(/start again/i);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("Secure Admin Login — authenticator (TOTP) step", () => {
  it("asks for the authenticator after the email code, then issues a session with mfa", async () => {
    const { user, email, secret } = await makeTotpAdmin();
    const r = await passEmailStep(email);
    expect(r.step.step).toBe("totp");
    if (r.step.step !== "totp") return;
    expect(r.step.state.stage).toBe("SECOND_FACTOR");
    expect(r.step.state.firstFactor).toBe("EMAIL_OTP");
    // No session exists until the second factor is proven.
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect((await getAdminChallengeState(r.challengeToken))?.stage).toBe("SECOND_FACTOR");

    const done = await verifyAdminSecondFactor(r.challengeToken, { code: totpAt(secret, totpStep()) }, r.meta);
    if (done.step !== "done") throw new Error("expected a session");
    const session = await resolveSessionByToken(done.session.token);
    expect(session?.id).toBe(user.id);
    expect(session?.security).toMatchObject({ mfa: true, twoFactorEnabled: true, authMethod: "EMAIL_OTP" });
    expect(await db.loginHistory.count({ where: { userId: user.id, success: true, method: "EMAIL_OTP+TOTP" } })).toBe(1);
  });

  it("refuses a replay of an authenticator code that was already used, but takes the next one", async () => {
    const { user, email, secret } = await makeTotpAdmin();
    const code = totpAt(secret, totpStep());
    const first = await passEmailStep(email);
    expect((await verifyAdminSecondFactor(first.challengeToken, { code }, first.meta)).step).toBe("done");

    const again = await passEmailStep(email);
    expect(again.step.step).toBe("totp");
    await expect(verifyAdminSecondFactor(again.challengeToken, { code }, again.meta)).rejects.toMatchObject({ status: 401 });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.loginHistory.count({ where: { userId: user.id, success: false, reason: "totp_bad_code" } })).toBe(1);

    // The next 30-second code is newer than the last one used, so it is accepted.
    const next = await verifyAdminSecondFactor(again.challengeToken, { code: totpAt(secret, totpStep() + 1) }, again.meta);
    expect(next.step).toBe("done");
  });

  it("pauses the second factor after 5 wrong codes, even for the right code", async () => {
    const { user, email, secret } = await makeTotpAdmin();
    const r = await passEmailStep(email);
    for (let i = 0; i < 5; i++) {
      await expect(verifyAdminSecondFactor(r.challengeToken, { code: wrongTotp(secret) }, r.meta)).rejects.toMatchObject({ status: 401 });
    }
    const locked = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(locked.mfaFailedCount).toBe(5);
    expect(locked.mfaLockedUntil && locked.mfaLockedUntil > new Date()).toBe(true);
    await expect(verifyAdminSecondFactor(r.challengeToken, { code: totpAt(secret, totpStep()) }, r.meta)).rejects.toMatchObject({ status: 429 });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.securityAlert.count({ where: { userId: user.id, type: "MFA_LOCKED" } })).toBe(1);
  });

  it("accepts a backup code exactly once", async () => {
    const { user, email } = await makeTotpAdmin();
    const codes = await replaceBackupCodes(user.id);
    expect(codes).toHaveLength(10);
    const backup = codes[0]!;

    const first = await passEmailStep(email);
    vi.mocked(sendSecurityEmail).mockClear();
    // Typed by hand: lower case, no dash.
    const done = await verifyAdminSecondFactor(first.challengeToken, { backupCode: backup.toLowerCase().replace("-", "") }, first.meta);
    if (done.step !== "done") throw new Error("expected a session");
    expect((await resolveSessionByToken(done.session.token))?.security.mfa).toBe(true);
    expect(sentEmails().some((m) => m.event === "BACKUP_CODE_USED" && m.email === email)).toBe(true);
    expect(await db.twoFactorBackupCode.count({ where: { userId: user.id, usedAt: null } })).toBe(9);

    const second = await passEmailStep(email);
    await expect(verifyAdminSecondFactor(second.challengeToken, { backupCode: backup }, second.meta)).rejects.toThrow(/already used/i);
    // A different, unused backup code still works.
    expect((await verifyAdminSecondFactor(second.challengeToken, { backupCode: codes[1]! }, second.meta)).step).toBe("done");
    expect(await db.twoFactorBackupCode.count({ where: { userId: user.id, usedAt: null } })).toBe(8);
  });

  it("continues a password sign-in of a 2FA administrator as a challenge, not a session", async () => {
    const { user, email, secret } = await makeTotpAdmin("STAFF");
    const meta = newMeta();
    const res = await login({ identifier: email, password: ADMIN_TEST_PASSWORD, ...meta });
    expect(res.kind).toBe("challenge");
    if (res.kind !== "challenge") return;
    expect(res.challengeToken.length).toBeGreaterThanOrEqual(40);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await getAdminChallengeState(res.challengeToken)).toMatchObject({ stage: "SECOND_FACTOR", firstFactor: "PASSWORD" });

    const done = await verifyAdminSecondFactor(res.challengeToken, { code: totpAt(secret, totpStep()) }, meta);
    if (done.step !== "done") throw new Error("expected a session");
    const session = await resolveSessionByToken(done.session.token);
    expect(session?.security).toMatchObject({ authMethod: "PASSWORD", mfa: true });
  });
});

describe("administrator session policy (resolveSessionByToken)", () => {
  it("refuses an administrator session that skipped the second factor when the account has 2FA", async () => {
    const { user } = await makeTotpAdmin();
    const without = await createSession(user.id, { role: "SUPER_ADMIN", authMethod: "PASSWORD", mfa: false });
    expect(await resolveSessionByToken(without.token)).toBeNull();
    const withMfa = await createSession(user.id, { role: "SUPER_ADMIN", authMethod: "EMAIL_OTP", mfa: true });
    expect((await resolveSessionByToken(withMfa.token))?.id).toBe(user.id);
  });

  it("ends an idle administrator session for good, but not a student's", async () => {
    const { user } = await makeAdminAccount({ role: "STAFF" });
    const s = await createSession(user.id, { role: "STAFF", authMethod: "EMAIL_OTP" });
    expect((await resolveSessionByToken(s.token))?.id).toBe(user.id);

    await db.session.update({ where: { id: s.sessionId }, data: { lastSeenAt: new Date(Date.now() - adminIdleMs() - 60_000) } });
    expect(await resolveSessionByToken(s.token)).toBeNull();
    const row = await db.session.findUniqueOrThrow({ where: { id: s.sessionId } });
    expect(row.revokedAt).not.toBeNull();
    // Activity afterwards does not bring it back.
    await db.session.update({ where: { id: s.sessionId }, data: { lastSeenAt: new Date() } });
    expect(await resolveSessionByToken(s.token)).toBeNull();

    const student = await db.user.create({ data: { name: "Idle Student", email: `${uid("idle")}@student.test`, mobile: randomMobile("6"), passwordHash: "unused", role: "STUDENT" } });
    const ss = await createSession(student.id, { role: "STUDENT", authMethod: "PASSWORD" });
    await db.session.update({ where: { id: ss.sessionId }, data: { lastSeenAt: new Date(Date.now() - adminIdleMs() - 60_000) } });
    expect((await resolveSessionByToken(ss.token))?.id).toBe(student.id);
  });

  it("caps an administrator session's lifetime regardless of remember-me", async () => {
    const { user } = await makeAdminAccount();
    const s = await createSession(user.id, { role: "SUPER_ADMIN", remember: true });
    expect(s.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(adminSessionMs() + 1000);
    expect(adminSessionMs()).toBeLessThan(7 * 24 * 60 * 60_000);
  });
});

describe("Secure Admin Login — no account enumeration", () => {
  it("answers wrong codes identically for an unknown address and a real administrator", async () => {
    const { email } = await makeAdminAccount();
    const real = await requestCode(email);
    const unknown = await requestCode(`${uid("ghost")}@admin.test`);
    const realOutcomes: string[] = [];
    const unknownOutcomes: string[] = [];
    for (let i = 0; i < ADMIN_OTP_MAX_ATTEMPTS + 1; i++) {
      realOutcomes.push(await outcome(verifyAdminEmailOtp(real.challengeToken, wrongCode(real.code!), real.meta)));
      unknownOutcomes.push(await outcome(verifyAdminEmailOtp(unknown.challengeToken, "000000", unknown.meta)));
    }
    expect(unknownOutcomes).toEqual(realOutcomes);
  });

  it("answers resends identically for an unknown address and a real administrator", async () => {
    const { user, email } = await makeAdminAccount();
    const real = await requestCode(email);
    const unknown = await requestCode(`${uid("ghost")}@admin.test`);
    const realOutcomes: string[] = [];
    const unknownOutcomes: string[] = [];
    for (let i = 0; i < 6; i++) {
      // Step past the resend cooldown instead of sleeping.
      await db.loginOtp.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 120_000) } });
      realOutcomes.push(await outcome(resendAdminEmailOtp(real.challengeToken, real.meta)));
      unknownOutcomes.push(await outcome(resendAdminEmailOtp(unknown.challengeToken, unknown.meta)));
    }
    expect(unknownOutcomes).toEqual(realOutcomes);
  });
});
