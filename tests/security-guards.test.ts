import { afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  sendSecurityEmail: vi.fn(async () => ({ ok: true })),
}));

import { db } from "@/lib/db";
import { sendSecurityEmail } from "@/lib/notifications";
import { encryptSecret } from "@/lib/crypto";
import { createSession, resolveSessionByToken } from "@/lib/auth/session";
import { generateTotpSecret } from "@/lib/auth/totp";
import { setSettings } from "@/lib/settings";
import { createStaff, setStaffRole, staffCreateSchema, updateStaff } from "@/server/staff";
import { getSecuritySettings, revokeAllAdminSessions, securitySettingsSchema, updateSecuritySettings } from "@/server/security";
import { adminAuthUser, makeAdminAccount, randomMobile, uid } from "./helpers";

/**
 * Privilege guards around administrators: who may edit whom, which roles staff can hold, who may
 * sign whom out, and the 2FA switch that must never lock its own author out.
 */

const ORIGINAL_KEY = process.env.DATA_ENCRYPTION_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = ORIGINAL_KEY;
});

const sentEmails = () => vi.mocked(sendSecurityEmail).mock.calls.map(([input]) => input);

async function superAdmin() {
  const account = await makeAdminAccount({ role: "SUPER_ADMIN" });
  return { ...account, auth: await adminAuthUser(account.user.id) };
}

async function staffMember(level: number, permissions: string[] = []) {
  const account = await makeAdminAccount({ role: "STAFF", level, permissions });
  return { ...account, auth: await adminAuthUser(account.user.id) };
}

const liveSessions = (userId: string) => db.session.count({ where: { userId, revokedAt: null } });

describe("updateStaff — editing administrators", () => {
  it("lets only a Super Admin edit a Super Admin", async () => {
    const target = await makeAdminAccount({ role: "SUPER_ADMIN", staffRow: true });
    const seniorStaff = await staffMember(1, ["users.view", "users.update"]);
    const input = { name: "Renamed By Staff", email: target.email, mobile: target.user.mobile };

    await expect(updateStaff(target.staffId!, input, { user: seniorStaff.auth })).rejects.toMatchObject({ status: 403 });
    expect((await db.user.findUniqueOrThrow({ where: { id: target.user.id } })).name).toBe(target.user.name);

    const boss = await superAdmin();
    const updated = await updateStaff(target.staffId!, { ...input, name: "Renamed By Super Admin" }, { user: boss.auth });
    expect(updated.user.name).toBe("Renamed By Super Admin");
  });

  it("lets only a Super Admin change anyone's login email or mobile", async () => {
    const target = await makeAdminAccount({ role: "STAFF", level: 3 });
    const editor = await staffMember(1, ["users.view", "users.update"]);
    const base = { name: target.user.name, email: target.email, mobile: target.user.mobile };

    await expect(updateStaff(target.staffId!, { ...base, email: `${uid("new")}@admin.test` }, { user: editor.auth })).rejects.toMatchObject({ status: 403 });
    await expect(updateStaff(target.staffId!, { ...base, mobile: randomMobile("7") }, { user: editor.auth })).rejects.toMatchObject({ status: 403 });
    await expect(updateStaff(target.staffId!, { ...base, mobile: null }, { user: editor.auth })).rejects.toMatchObject({ status: 403 });
    const unchanged = await db.user.findUniqueOrThrow({ where: { id: target.user.id } });
    expect(unchanged.email).toBe(target.email);
    expect(unchanged.mobile).toBe(target.user.mobile);

    // Other profile fields are fine, and the same address in another case is not a change.
    const updated = await updateStaff(target.staffId!, { ...base, email: target.email.toUpperCase(), name: "New Name", designation: "Coordinator" }, { user: editor.auth });
    expect(updated.user.name).toBe("New Name");
    expect(updated.designation).toBe("Coordinator");
    expect(updated.user.email).toBe(target.email);

    // A Super Admin may change it: every session of the member ends and the OLD address is told.
    const session = await createSession(target.user.id, { role: "STAFF", authMethod: "EMAIL_OTP" });
    const boss = await superAdmin();
    vi.mocked(sendSecurityEmail).mockClear();
    const newEmail = `${uid("moved")}@admin.test`;
    const moved = await updateStaff(target.staffId!, { ...base, name: "New Name", email: newEmail }, { user: boss.auth });
    expect(moved.user.email).toBe(newEmail);
    expect(await resolveSessionByToken(session.token)).toBeNull();
    expect(sentEmails().some((m) => m.event === "LOGIN_EMAIL_CHANGED" && m.email === target.email)).toBe(true);
    expect(await db.securityAlert.count({ where: { userId: target.user.id, type: "LOGIN_EMAIL_CHANGED" } })).toBe(1);
  });

  it("does not treat an unchanged mobile stored in the older bare-digit form as a change", async () => {
    const digits = `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
    const target = await makeAdminAccount({ role: "STAFF", level: 3, mobile: digits });
    const editor = await staffMember(1, ["users.view", "users.update"]);
    const updated = await updateStaff(target.staffId!, { name: "Legacy Mobile", email: target.email, mobile: digits, designation: "Field officer" }, { user: editor.auth });
    expect(updated.designation).toBe("Field officer");
  });
});

describe("staff roles — Super Admin is an account type, not a role", () => {
  it("refuses the super-admin role slug in setStaffRole and createStaff", async () => {
    const superRole = await db.role.upsert({ where: { slug: "super-admin" }, create: { name: `Super Admin ${uid("")}`, slug: "super-admin", level: 1 }, update: {} });
    const target = await makeAdminAccount({ role: "STAFF", level: 3 });
    const boss = await superAdmin();

    await expect(setStaffRole(target.staffId!, superRole.id, { user: boss.auth })).rejects.toMatchObject({
      status: 422,
      details: { roleId: expect.stringMatching(/not a staff role/i) },
    });
    expect((await db.staff.findUniqueOrThrow({ where: { id: target.staffId! } })).roleId).not.toBe(superRole.id);

    const email = `${uid("new")}@admin.test`;
    await expect(createStaff(staffCreateSchema.parse({ name: "Would Be Super", email, roleId: superRole.id }), { user: boss.auth })).rejects.toMatchObject({ status: 422 });
    expect(await db.user.count({ where: { email } })).toBe(0);

    // An ordinary role is accepted.
    const manager = await db.role.create({ data: { name: `Manager ${uid("")}`, slug: uid("manager"), level: 2 } });
    const assigned = await setStaffRole(target.staffId!, manager.id, { user: boss.auth });
    expect(assigned.role?.id).toBe(manager.id);
  });
});

describe("revokeAllAdminSessions — tiers", () => {
  it("refuses a staff member without security.manage", async () => {
    const actor = await staffMember(1, ["security.view"]);
    const target = await makeAdminAccount({ role: "STAFF", level: 3 });
    await createSession(target.user.id, { role: "STAFF" });
    await expect(revokeAllAdminSessions(target.user.id, { user: actor.auth })).rejects.toMatchObject({ status: 403 });
    expect(await liveSessions(target.user.id)).toBe(1);
  });

  it("refuses a manager acting on an equal or higher tier, or on a Super Admin", async () => {
    const actor = await staffMember(2, ["security.view", "security.manage"]);
    const peer = await makeAdminAccount({ role: "STAFF", level: 2 });
    const senior = await makeAdminAccount({ role: "STAFF", level: 1 });
    const top = await makeAdminAccount({ role: "SUPER_ADMIN" });
    for (const t of [peer, senior, top]) await createSession(t.user.id, { role: t.user.role });

    await expect(revokeAllAdminSessions(peer.user.id, { user: actor.auth })).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/below your own tier/i) });
    await expect(revokeAllAdminSessions(senior.user.id, { user: actor.auth })).rejects.toMatchObject({ status: 403 });
    await expect(revokeAllAdminSessions(top.user.id, { user: actor.auth })).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/super admin/i) });
    for (const t of [peer, senior, top]) expect(await liveSessions(t.user.id)).toBe(1);
  });

  it("lets a manager sign out a lower tier, and themselves except for the current session", async () => {
    const actor = await staffMember(2, ["security.view", "security.manage"]);
    const junior = await makeAdminAccount({ role: "STAFF", level: 3 });
    await createSession(junior.user.id, { role: "STAFF" });
    await createSession(junior.user.id, { role: "STAFF" });

    expect(await revokeAllAdminSessions(junior.user.id, { user: actor.auth })).toEqual({ revoked: 2 });
    expect(await liveSessions(junior.user.id)).toBe(0);
    expect(await db.securityAlert.count({ where: { userId: junior.user.id, type: "SESSIONS_REVOKED" } })).toBe(1);

    const other = await createSession(actor.user.id, { role: "STAFF" });
    expect(await revokeAllAdminSessions(actor.user.id, { user: actor.auth })).toEqual({ revoked: 1 });
    expect(await resolveSessionByToken(other.token)).toBeNull();
    expect((await db.session.findUniqueOrThrow({ where: { id: actor.auth.sessionId } })).revokedAt).toBeNull();
  });

  it("lets a Super Admin sign out anyone, including another Super Admin", async () => {
    const boss = await superAdmin();
    const otherBoss = await makeAdminAccount({ role: "SUPER_ADMIN" });
    await createSession(otherBoss.user.id, { role: "SUPER_ADMIN" });
    expect(await revokeAllAdminSessions(otherBoss.user.id, { user: boss.auth })).toEqual({ revoked: 1 });
  });
});

describe("updateSecuritySettings — requiring 2FA", () => {
  const input = { require2faForAdmins: true, alertEmail: "", newDeviceAlerts: true };

  it("refuses a staff member outright", async () => {
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    const actor = await staffMember(1, ["security.view", "security.manage"]);
    await expect(updateSecuritySettings(input, { user: actor.auth })).rejects.toMatchObject({ status: 403 });
  });

  it("refuses without DATA_ENCRYPTION_KEY, and refuses a Super Admin who has no 2FA", async () => {
    const boss = await superAdmin();
    delete process.env.DATA_ENCRYPTION_KEY;
    await expect(updateSecuritySettings(input, { user: boss.auth })).rejects.toThrow(/DATA_ENCRYPTION_KEY/);

    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    expect(boss.auth.security.twoFactorEnabled).toBe(false);
    await expect(updateSecuritySettings(input, { user: boss.auth })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/authenticator/i) });
    expect((await getSecuritySettings()).require2faForAdmins).toBe(false);
  });

  it("lets a Super Admin who uses 2FA require it — sessions without a second factor then stop working", async () => {
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    const account = await makeAdminAccount({ role: "SUPER_ADMIN", totpSecretEnc: encryptSecret(generateTotpSecret()) });
    const boss = await adminAuthUser(account.user.id, { mfa: true });
    expect(boss.security.twoFactorEnabled).toBe(true);
    const staff = await makeAdminAccount({ role: "STAFF", level: 3 });
    const staffSession = await createSession(staff.user.id, { role: "STAFF", authMethod: "EMAIL_OTP" });
    expect(await resolveSessionByToken(staffSession.token)).not.toBeNull();
    try {
      const after = await updateSecuritySettings(input, { user: boss });
      expect(after.require2faForAdmins).toBe(true);
      expect(await resolveSessionByToken(staffSession.token)).toBeNull();
      expect((await db.securityAlert.findFirst({ where: { type: "SECURITY_SETTINGS_CHANGED", userId: account.user.id } }))?.severity).toBe("warning");
    } finally {
      await setSettings({ "security.require2faForAdmins": false });
    }
    expect((await getSecuritySettings()).require2faForAdmins).toBe(false);
  });

  it("validates the alert address (no header injection)", () => {
    expect(securitySettingsSchema.safeParse({ ...input, alertEmail: "INFO@EduSkillIndia.com" })).toMatchObject({ success: true, data: { alertEmail: "info@eduskillindia.com" } });
    expect(securitySettingsSchema.safeParse({ ...input, alertEmail: "not-an-email" }).success).toBe(false);
    expect(securitySettingsSchema.safeParse({ ...input, alertEmail: "a@x.com\r\nBcc: evil@x.com" }).success).toBe(false);
  });
});
