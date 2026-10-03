import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";

// Sign-in codes are captured from the (mocked) security email instead of a real mailbox.
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  sendSecurityEmail: vi.fn(async () => ({ ok: true })),
  isEmailConfigured: vi.fn(async () => true),
}));
// Route handlers resolve the signed-in user through getSessionUser (cookies); tests hand it in.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  getSessionUser: vi.fn(async () => null),
}));

import { NextRequest } from "next/server";
import { db, type Prisma } from "@/lib/db";
import { sendSecurityEmail } from "@/lib/notifications";
import { encryptSecret, isEncrypted, sha256 } from "@/lib/crypto";
import { getSessionUser, postLoginRedirect } from "@/lib/auth/session";
import { hashDeviceId } from "@/lib/auth/device";
import { generateTotpSecret, totpAt, totpStep } from "@/lib/auth/totp";
import { audit } from "@/lib/audit";
import { putBuffer } from "@/lib/storage";
import { getSetting, invalidateSettingsCache, loadSettings, storedSecretIssues, undecryptableSecretKeys } from "@/lib/settings";
import { verifyRazorpayCheckoutSignature, verifyRazorpayWebhookSignature } from "@/lib/payments";
import { login } from "@/server/auth";
import { ADMIN_OTP_NEUTRAL_MESSAGE, getAdminChallengeState, resendAdminEmailOtp, safeAdminNext, startAdminEmailOtp, verifyAdminEmailOtp, verifyAdminSecondFactor } from "@/server/admin-auth";
import { beginTwoFactorSetup, verifyUserSecondFactor } from "@/server/two-factor";
import { getStaff, listStaff, staffListSchema, staffLoginHistory, updateStaff } from "@/server/staff";
import { acknowledgeAlerts } from "@/server/security";
import { donationListSchema, exportDonationsCsv } from "@/server/donations-admin";
import { auditListSchema, getAuditLog, listAuditLogs } from "@/app/admin/audit-logs/queries";
import { GET as filesGET } from "@/app/api/files/[...key]/route";
import { GET as settingsGET } from "@/app/api/admin/settings/route";
import { encryptPlaintextSecrets, type ApplyAdminSecurityResult } from "../scripts/apply-admin-security";
import { ADMIN_TEST_PASSWORD, adminAuthUser, makeAdminAccount, randomMobile, uid } from "./helpers";
import { hashPassword } from "@/lib/auth/password";

/**
 * Regression tests for the October 2026 security review: sign-in quotas and races, the open
 * redirect, the private-file bypass, staff/alert/settings visibility by tier, secrets at rest and
 * the donations export. Each block names the finding it pins down.
 */

const ORIGINAL_KEY = process.env.DATA_ENCRYPTION_KEY;
const TEST_KEY = randomBytes(32).toString("hex");

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
  process.env.DATA_ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = ORIGINAL_KEY;
});

let seq = 0;
/** This file's own 10.x network, apart from admin-auth.test.ts (10.77.x.x). */
const NET = 100 + Math.floor(Math.random() * 100);
/** A distinct browser on a distinct network. */
function newMeta() {
  seq += 1;
  return {
    ip: `10.${NET}.${Math.floor(seq / 250)}.${(seq % 250) + 1}`,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
    deviceId: randomBytes(24).toString("base64url"),
  };
}

const otpMails = () => vi.mocked(sendSecurityEmail).mock.calls.map(([input]) => input).filter((m) => m.event === "ADMIN_LOGIN_OTP");

async function requestCode(email: string, meta = newMeta()) {
  vi.mocked(sendSecurityEmail).mockClear();
  const res = await startAdminEmailOtp({ email, ...meta });
  const mail = otpMails()[0];
  return { ...res, meta, mail, code: mail ? String(mail.data.code) : undefined };
}

async function staffMember(level: number, permissions: string[] = []) {
  const account = await makeAdminAccount({ role: "STAFF", level, permissions });
  return { ...account, auth: await adminAuthUser(account.user.id) };
}

async function statusOf(p: Promise<unknown>): Promise<number> {
  try {
    await p;
    return 200;
  } catch (err) {
    return (err as { status?: number }).status ?? 500;
  }
}

// ───────────────────────────── F2 / F18: open redirect ─────────────────────────────

describe("postLoginRedirect / safeAdminNext — open redirect", () => {
  it("keeps an app-relative destination and refuses anything a browser would read as another site", () => {
    expect(postLoginRedirect("/student/applications?tab=open#top", "STUDENT")).toBe("/student/applications?tab=open#top");
    expect(postLoginRedirect("/courses/web-design", "TRAINER")).toBe("/courses/web-design");
    // Spaces are percent-encoded, not refused.
    expect(postLoginRedirect("/admin/students?q=Ram Kumar", "STAFF")).toBe("/admin/students?q=Ram%20Kumar");

    for (const evil of ["/\t/evil.example/login", "/\n/evil.example", "/\r/evil.example", "//evil.example", "/\\evil.example", "/.//evil.example", "/%09/x\t", "https://evil.example", "evil.example", ""]) {
      expect(postLoginRedirect(evil, "STUDENT"), JSON.stringify(evil)).toBe("/student/dashboard");
    }
    expect(postLoginRedirect(null, "SUPER_ADMIN")).toBe("/admin/dashboard");
    // Whatever comes back must not resolve off-site.
    for (const v of ["/a/../..//evil.example", "/./\\/evil.example"]) {
      const out = postLoginRedirect(v, "STUDENT");
      expect(new URL(out, "https://eduskillindia.com/login").origin).toBe("https://eduskillindia.com");
    }
  });

  it("refuses control characters in the admin destination too", () => {
    expect(safeAdminNext("/admin/security")).toBe("/admin/security");
    expect(safeAdminNext("/admin/\t/evil.example")).toBe("/admin/dashboard");
    expect(safeAdminNext("/admin\n/x")).toBe("/admin/dashboard");
  });
});

// ───────────────────────────── F6: private files ─────────────────────────────

describe("GET /api/files/[...key] — private files", () => {
  const get = (parts: string[]) => filesGET(new NextRequest("http://localhost:3000/api/files/x"), { params: Promise.resolve({ key: parts }) });

  it("refuses an encoded leading slash or backslash instead of skipping the access check", async () => {
    const owner = uid("stu");
    const stored = await putBuffer(`private/students/${owner}/${uid("doc")}.pdf`, Buffer.from("%PDF-1.4 private"));
    const parts = stored.key.split("/");
    vi.mocked(getSessionUser).mockResolvedValue(null);
    try {
      // Next decodes %2F / %5C inside a segment: these are the parts the route receives.
      for (const bad of [["/private", ...parts.slice(1)], ["\\private", ...parts.slice(1)], ["", ...parts], [".", ...parts], ["private", "students/" + owner, ...parts.slice(3)]]) {
        const res = await get(bad);
        expect(res.status, JSON.stringify(bad)).toBe(400);
      }
      // The plain path still needs a session.
      expect((await get(parts)).status).toBe(401);
    } finally {
      vi.mocked(getSessionUser).mockReset();
      vi.mocked(getSessionUser).mockResolvedValue(null);
    }

    // Public files stay open and cacheable.
    const pub = await putBuffer(`public/tests/${uid("pub")}.pdf`, Buffer.from("%PDF-1.4 public"));
    const res = await get(pub.key.split("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("public");
  });
});

// ───────────────────────────── F1 / F5 / F24: admin email-code quota ─────────────────────────────

describe("Secure Admin Login — code quota", () => {
  it("does not let a stranger use up the administrator's own codes (F1)", async () => {
    const { email } = await makeAdminAccount();
    const attacker = newMeta();
    vi.mocked(sendSecurityEmail).mockClear();
    for (let i = 0; i < 8; i++) await startAdminEmailOtp({ email, ...attacker });
    // The attacker's own browser + network gets 5 codes an hour, then nothing.
    expect(otpMails()).toHaveLength(5);

    const own = await requestCode(email);
    expect(own.mail).toBeDefined();
    expect((await verifyAdminEmailOtp(own.challengeToken, own.code!, own.meta)).step).toBe("done");
  });

  it("caps an address across all new browsers, but never a browser that signed in before (F1)", async () => {
    const { user, email } = await makeAdminAccount();
    vi.mocked(sendSecurityEmail).mockClear();
    for (let i = 0; i < 30; i++) await startAdminEmailOtp({ email, ...newMeta() });
    expect(otpMails()).toHaveLength(30);

    const stranger = await requestCode(email);
    expect(stranger.mail).toBeUndefined();
    expect(stranger.message).toBe(ADMIN_OTP_NEUTRAL_MESSAGE);
    expect(await db.securityAlert.count({ where: { userId: user.id, type: "OTP_ABUSE" } })).toBe(1);

    const known = newMeta();
    await db.loginHistory.create({ data: { userId: user.id, identifier: email, success: true, method: "EMAIL_OTP", deviceIdHash: hashDeviceId(known.deviceId) } });
    const mine = await requestCode(email, known);
    expect(mine.mail).toBeDefined();
  });

  it("expires the old code when a resend cannot send a new one, so the reset attempt counter gives it no extra guesses (F5)", async () => {
    const { user, email } = await makeAdminAccount();
    const meta = newMeta();
    const first = await requestCode(email, meta);
    expect(first.code).toMatch(/^\d{6}$/);
    for (let i = 0; i < 4; i++) await startAdminEmailOtp({ email, ...meta }); // this source's 5 codes are used

    const otp = await db.loginOtp.findFirstOrThrow({ where: { userId: user.id, purpose: "ADMIN_LOGIN" }, orderBy: { createdAt: "asc" } });
    await db.authChallenge.update({ where: { id: otp.challengeId! }, data: { codeSentAt: new Date(Date.now() - 120_000), codeAttempts: 3 } });
    vi.mocked(sendSecurityEmail).mockClear();
    await resendAdminEmailOtp(first.challengeToken, meta);
    expect(otpMails()).toHaveLength(0);

    const after = await db.loginOtp.findUniqueOrThrow({ where: { id: otp.id } });
    expect(after.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
    await expect(verifyAdminEmailOtp(first.challengeToken, first.code!, meta)).rejects.toMatchObject({ status: 401 });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

// ───────────────────────────── F3: second-factor races ─────────────────────────────

function wrongTotp(secret: string) {
  const now = totpStep();
  const valid = new Set([-2, -1, 0, 1, 2].map((d) => totpAt(secret, now + d)));
  for (let n = 0; ; n++) {
    const c = String(n).padStart(6, "0");
    if (!valid.has(c)) return c;
  }
}

async function makeTotpAdmin() {
  const secret = generateTotpSecret();
  const account = await makeAdminAccount({ role: "STAFF", totpSecretEnc: encryptSecret(secret) });
  return { ...account, secret };
}

describe("second factor — brute-force bounds (F3)", () => {
  it("checks at most 5 codes from a burst of parallel guesses, then pauses", async () => {
    const { user, secret } = await makeTotpAdmin();
    const bad = wrongTotp(secret);
    const statuses = await Promise.all(Array.from({ length: 8 }, () => statusOf(verifyUserSecondFactor(user.id, { code: bad }))));
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(3);
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.mfaFailedCount).toBe(5);
    expect(after.mfaLockedUntil && after.mfaLockedUntil > new Date()).toBe(true);
    expect(await db.securityAlert.count({ where: { userId: user.id, type: "MFA_LOCKED" } })).toBe(1);
    // Paused even for the right code.
    expect(await statusOf(verifyUserSecondFactor(user.id, { code: totpAt(secret, totpStep()) }))).toBe(429);
  });

  it("clears the count on a correct code", async () => {
    const { user, secret } = await makeTotpAdmin();
    await expect(verifyUserSecondFactor(user.id, { code: wrongTotp(secret) })).rejects.toMatchObject({ status: 401 });
    expect(await verifyUserSecondFactor(user.id, { code: totpAt(secret, totpStep()) })).toBe("TOTP");
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).mfaFailedCount).toBe(0);
  });

  it("caps the guesses one sign-in challenge may make, like the email-code step", async () => {
    const { user, email, secret } = await makeTotpAdmin();
    const meta = newMeta();
    const res = await login({ identifier: email, password: ADMIN_TEST_PASSWORD, ...meta });
    if (res.kind !== "challenge") throw new Error("expected a second-factor challenge");
    await db.authChallenge.update({ where: { tokenHash: sha256(`challenge:${res.challengeToken}`) }, data: { attempts: 12 } });
    await expect(verifyAdminSecondFactor(res.challengeToken, { code: totpAt(secret, totpStep()) }, meta)).rejects.toThrow(/start again/i);
    expect(await getAdminChallengeState(res.challengeToken)).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

// ───────────────────────────── F4 / F24: password lock ─────────────────────────────

async function makeStudentLogin(password = "Right123") {
  const email = `${uid("pw")}@test.local`;
  const user = await db.user.create({ data: { name: "Lock Race", email, mobile: randomMobile("7"), passwordHash: await hashPassword(password), role: "STUDENT", student: { create: { name: "Lock Race", mobile: "0" } } } });
  return { user, email, password };
}

describe("password sign-in — lock and per-network limits (F4, F24)", () => {
  it("compares at most 5 passwords from a burst of parallel guesses", async () => {
    const { user, email, password } = await makeStudentLogin();
    const statuses = await Promise.all(Array.from({ length: 8 }, () => statusOf(login({ identifier: email, password: "wrong-guess" }))));
    expect(statuses.every((s) => s === 401)).toBe(true);
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.failedLoginCount).toBe(5);
    expect(after.lockedUntil && after.lockedUntil > new Date()).toBe(true);
    expect(await db.loginHistory.count({ where: { userId: user.id, reason: "bad_password" } })).toBe(5);
    expect(await db.loginHistory.count({ where: { userId: user.id, reason: "locked" } })).toBe(3);
    await expect(login({ identifier: email, password })).rejects.toThrow(/locked/i);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("clears the count after a correct password", async () => {
    const { user, email, password } = await makeStudentLogin();
    for (let i = 0; i < 3; i++) await expect(login({ identifier: email, password: "nope" })).rejects.toMatchObject({ status: 401 });
    expect((await login({ identifier: email, password })).kind).toBe("session");
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).failedLoginCount).toBe(0);
  });

  it("caps wrong passwords per IP, but not successful sign-ins", async () => {
    const { email, password } = await makeStudentLogin();
    const office = newMeta().ip;
    for (let i = 0; i < 12; i++) expect((await login({ identifier: email, password, ip: office })).kind).toBe("session");

    const sprayer = newMeta().ip;
    for (let i = 0; i < 10; i++) await expect(login({ identifier: `${uid("nobody")}@test.local`, password: "guess", ip: sprayer })).rejects.toMatchObject({ status: 401 });
    await expect(login({ identifier: email, password, ip: sprayer })).rejects.toMatchObject({ status: 429 });
  });
});

// ───────────────────────────── F7 / F10: staff records ─────────────────────────────

describe("staff records — visibility and tiers (F7, F10)", () => {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";

  it("hides a Super Admin's record from staff and masks sign-in IPs and devices for non-Super-Admins", async () => {
    const sa = await makeAdminAccount({ role: "SUPER_ADMIN", staffRow: true });
    const boss = await adminAuthUser(sa.user.id);
    const viewer = await staffMember(1, ["users.view"]);
    await expect(getStaff(sa.staffId!, viewer.auth)).rejects.toMatchObject({ status: 404 });
    expect((await listStaff(staffListSchema.parse({ q: sa.email }), viewer.auth)).items).toHaveLength(0);
    expect((await listStaff(staffListSchema.parse({ q: sa.email }), boss)).items).toHaveLength(1);

    const target = await makeAdminAccount({ role: "STAFF", level: 3 });
    await db.loginHistory.create({ data: { userId: target.user.id, identifier: target.email, success: true, method: "EMAIL_OTP", ip: "203.0.113.45", userAgent: UA, deviceIdHash: "a".repeat(64) } });
    const seen = await getStaff(target.staffId!, viewer.auth);
    expect(seen.loginHistory[0]).toMatchObject({ ip: "203.0.113.x", userAgent: "Chrome on Windows", deviceIdHash: null });
    const paged = await staffLoginHistory(target.user.id, { page: 1, limit: 20 }, viewer.auth);
    expect(paged.items[0]).toMatchObject({ ip: "203.0.113.x", deviceIdHash: null });
    const full = await getStaff(target.staffId!, boss);
    expect(full.loginHistory[0]).toMatchObject({ ip: "203.0.113.45", userAgent: UA });
  });

  it("lets users.update edit only lower tiers and one's own profile (F10)", async () => {
    const peer = await makeAdminAccount({ role: "STAFF", level: 1 });
    const editor = await staffMember(1, ["users.view", "users.update"]);
    const profile = (a: { email: string; user: { mobile: string | null } }, name: string) => ({ name, email: a.email, mobile: a.user.mobile });

    await expect(updateStaff(peer.staffId!, profile(peer, "Renamed Peer"), { user: editor.auth })).rejects.toMatchObject({ status: 403 });
    const junior = await staffMember(3, ["users.update"]);
    await expect(updateStaff(peer.staffId!, profile(peer, "Renamed By Junior"), { user: junior.auth })).rejects.toMatchObject({ status: 403 });
    expect((await db.user.findUniqueOrThrow({ where: { id: peer.user.id } })).name).toBe(peer.user.name);

    expect((await updateStaff(editor.staffId!, profile(editor, "Editor Self"), { user: editor.auth })).user.name).toBe("Editor Self");
    const lower = await makeAdminAccount({ role: "STAFF", level: 2 });
    expect((await updateStaff(lower.staffId!, profile(lower, "Lower Renamed"), { user: editor.auth })).user.name).toBe("Lower Renamed");
  });

  it("masks a Super Admin's IP and device in the audit log for everyone else (F7)", async () => {
    const sa = await makeAdminAccount({ role: "SUPER_ADMIN" });
    const recordId = uid("rec");
    await audit({ user: { id: sa.user.id, name: sa.user.name, role: "SUPER_ADMIN" }, action: "login", module: "auth", recordType: "User", recordId, description: "signed in", ip: "198.51.100.77", userAgent: UA });
    const asStaff = await listAuditLogs(auditListSchema.parse({ recordId }), { role: "STAFF" });
    expect(asStaff.items[0]).toMatchObject({ ip: "198.51.100.x", userAgent: "Chrome on Windows" });
    expect((await getAuditLog(asStaff.items[0]!.id, { role: "STAFF" })).ip).toBe("198.51.100.x");
    const asSuper = await listAuditLogs(auditListSchema.parse({ recordId }), { role: "SUPER_ADMIN" });
    expect(asSuper.items[0]).toMatchObject({ ip: "198.51.100.77", userAgent: UA });
    // Searching by the full address does not find it for staff either.
    expect((await listAuditLogs(auditListSchema.parse({ recordId, q: "198.51.100.77" }), { role: "STAFF" })).items).toHaveLength(0);
    expect((await listAuditLogs(auditListSchema.parse({ recordId, q: "198.51.100.77" }), { role: "SUPER_ADMIN" })).items).toHaveLength(1);
  });
});

// ───────────────────────────── F9: alerts ─────────────────────────────

describe("acknowledgeAlerts — tiers (F9)", () => {
  it("lets security.manage clear alerts about lower tiers only — never about themselves, peers or a Super Admin", async () => {
    const manager = await staffMember(2, ["security.view", "security.manage"]);
    const peer = await makeAdminAccount({ role: "STAFF", level: 2 });
    const lower = await makeAdminAccount({ role: "STAFF", level: 3 });
    const sa = await makeAdminAccount({ role: "SUPER_ADMIN" });
    const alert = (userId: string | null) => db.securityAlert.create({ data: { type: "NEW_DEVICE_LOGIN", severity: "info", title: uid("alert"), userId } });
    const self = await alert(manager.user.id);
    const ofPeer = await alert(peer.user.id);
    const ofLower = await alert(lower.user.id);
    const general = await alert(null);
    const ofSuper = await alert(sa.user.id);
    const ctx = { user: manager.auth };

    await expect(acknowledgeAlerts([self.id], ctx)).rejects.toMatchObject({ status: 403 });
    await expect(acknowledgeAlerts([ofPeer.id], ctx)).rejects.toMatchObject({ status: 403 });
    expect((await acknowledgeAlerts([ofLower.id], ctx)).acknowledged).toBe(1);

    const another = await alert(lower.user.id);
    await acknowledgeAlerts("all", ctx);
    const open = async (id: string) => (await db.securityAlert.findUniqueOrThrow({ where: { id } })).acknowledgedAt === null;
    expect(await open(self.id)).toBe(true);
    expect(await open(ofPeer.id)).toBe(true);
    expect(await open(ofSuper.id)).toBe(true);
    expect(await open(general.id)).toBe(false);
    expect(await open(another.id)).toBe(false);
  });
});

// ───────────────────────────── F8 / F19: settings API, session errors ─────────────────────────────

describe("GET /api/admin/settings (F8) and the session-ended error code (F19)", () => {
  const get = () => settingsGET(new NextRequest("http://localhost:3000/api/admin/settings"));

  it("leaves Super-Admin-only groups out for staff, and answers a missing session with SESSION_REQUIRED", async () => {
    const viewer = await staffMember(1, ["settings.view"]);
    vi.mocked(getSessionUser).mockResolvedValueOnce(viewer.auth);
    const asStaff = (await (await get()).json()) as { data: { groups: { key: string }[]; values: Record<string, unknown> } };
    const staffKeys = Object.keys(asStaff.data.values);
    expect(staffKeys.some((k) => k.startsWith("comms.") || k.startsWith("security."))).toBe(false);
    expect(asStaff.data.groups.map((g) => g.key)).not.toContain("comms");
    expect(asStaff.data.groups.map((g) => g.key)).not.toContain("security");
    // A Super-Admin-only key in a shared group stays (the page shows it read-only).
    expect(staffKeys).toContain("email.maxRecipients");

    const boss = await adminAuthUser((await makeAdminAccount({ role: "SUPER_ADMIN" })).user.id);
    vi.mocked(getSessionUser).mockResolvedValueOnce(boss);
    const asSuper = (await (await get()).json()) as { data: { values: Record<string, unknown> } };
    expect(asSuper.data.values).toHaveProperty("comms.smtpHost");

    vi.mocked(getSessionUser).mockResolvedValueOnce(null);
    const anon = await get();
    expect(anon.status).toBe(401);
    expect(((await anon.json()) as { error: { code: string } }).error.code).toBe("SESSION_REQUIRED");
  });
});

// ───────────────────────────── F17: recent sign-in ─────────────────────────────

describe("self-service 2FA set-up needs a recent sign-in (F17)", () => {
  it("refuses an old session and accepts a fresh one", async () => {
    const account = await makeAdminAccount({ role: "STAFF", level: 3 });
    const old = await adminAuthUser(account.user.id);
    await db.session.update({ where: { id: old.sessionId }, data: { createdAt: new Date(Date.now() - 60 * 60_000) } });
    await expect(beginTwoFactorSetup({ user: old })).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/recent sign-in/i) });

    const fresh = await adminAuthUser(account.user.id);
    const payload = await beginTwoFactorSetup({ user: fresh });
    expect(payload.manualKey.length).toBeGreaterThan(10);
  });
});

// ───────────────────────────── F15 / F16: secrets ─────────────────────────────

describe("payment signatures and stored secrets (F15, F16)", () => {
  it("never verifies a signature against an empty secret", () => {
    const sig = (secret: string) => createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
    expect(verifyRazorpayCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature: sig(""), secret: "" })).toBe(false);
    expect(verifyRazorpayCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature: sig("s3cret"), secret: "s3cret" })).toBe(true);
    const body = '{"event":"payment.captured"}';
    expect(verifyRazorpayWebhookSignature(body, createHmac("sha256", "").update(body).digest("hex"), "")).toBe(false);
  });

  it("reports and encrypts secrets left in plain text, and flags one the current key cannot read", async () => {
    const key = "comms.whatsappApiKey";
    const before = await db.setting.findUnique({ where: { key } });
    try {
      await db.setting.upsert({ where: { key }, create: { key, group: "comms", value: "plain-whatsapp-token", isPublic: false }, update: { value: "plain-whatsapp-token" } });
      invalidateSettingsCache();
      const issues = await storedSecretIssues();
      expect(issues.some((i) => i.includes(key) && /plain text/i.test(i))).toBe(true);
      expect(issues.join(" ")).not.toContain("plain-whatsapp-token");

      const r: ApplyAdminSecurityResult = {
        permissionsCreated: 0,
        permissionsUpdated: 0,
        rolesCreated: [],
        roleLevelsSet: [],
        rolesSkipped: [],
        otherRolesFixed: 0,
        resetLinksHidden: 0,
        tempPasswordsRemoved: 0,
        auditLogsRedacted: 0,
        secretsEncrypted: [],
        secretsSkippedNoKey: false,
      };
      await encryptPlaintextSecrets(true, r);
      expect(r.secretsEncrypted).toContain(key);
      expect((await db.setting.findUniqueOrThrow({ where: { key } })).value).toBe("plain-whatsapp-token"); // dry run
      r.secretsEncrypted = [];
      await encryptPlaintextSecrets(false, r);
      expect(r.secretsEncrypted).toContain(key);
      const stored = (await db.setting.findUniqueOrThrow({ where: { key } })).value;
      expect(isEncrypted(stored)).toBe(true);
      expect(await getSetting(key)).toBe("plain-whatsapp-token");
      expect((await storedSecretIssues()).some((i) => i.includes(key))).toBe(false);

      // The key changes: the value reads as "" (never as a usable secret) and is reported.
      process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("hex");
      await loadSettings(true);
      expect(await getSetting(key)).toBe("");
      expect(undecryptableSecretKeys()).toContain(key);
      expect((await storedSecretIssues()).some((i) => i.includes(key) && /cannot be decrypted/i.test(i))).toBe(true);
    } finally {
      process.env.DATA_ENCRYPTION_KEY = TEST_KEY;
      if (before) await db.setting.update({ where: { key }, data: { value: (before.value ?? "") as Prisma.InputJsonValue } });
      else await db.setting.deleteMany({ where: { key } });
      invalidateSettingsCache();
      await loadSettings(true);
    }
  });
});

// ───────────────────────────── P1: donations export ─────────────────────────────

describe("donations CSV export — PAN (P1)", () => {
  it("gives the full PAN to a Super Admin only", async () => {
    const donationNo = uid("DON").toUpperCase();
    await db.donation.create({ data: { donationNo, donorName: "Asha Donor", pan: "ABCDE1234F", amount: 500, status: "COMPLETED" } });
    const q = donationListSchema.parse({ q: donationNo });
    const staffRows = await exportDonationsCsv(q, { role: "STAFF" });
    expect(staffRows).toHaveLength(1);
    expect(staffRows[0]!.pan).toBe("••••••234F");
    expect((await exportDonationsCsv(q, { role: "SUPER_ADMIN" }))[0]!.pan).toBe("ABCDE1234F");
  });
});

