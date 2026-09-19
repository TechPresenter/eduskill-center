import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { login, registerStudent, requestPasswordReset, resetPassword } from "@/server/auth";
import { resolveSessionByToken } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { hashPassword } from "@/lib/auth/password";
import { ensurePermissions, uid } from "./helpers";

describe("authentication", () => {
  it("registers a student and logs in, creating a resolvable session", async () => {
    const mobile = `98${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    const user = await registerStudent({ name: "Asha Test", mobile, email: `${uid("asha")}@test.local`, password: "Secret123" });
    expect(user.role).toBe("STUDENT");
    expect(user.student).not.toBeNull();

    const result = await login({ identifier: mobile, password: "Secret123", ip: "127.0.0.1", userAgent: "vitest" });
    expect(result.token).toBeTruthy();
    const session = await resolveSessionByToken(result.token);
    expect(session?.id).toBe(user.id);
    expect(session?.student?.id).toBe(user.student!.id);
    expect(session?.permissions).toEqual([]);

    const history = await db.loginHistory.findMany({ where: { userId: user.id } });
    expect(history.some((h) => h.success)).toBe(true);
  });

  it("rejects wrong passwords, tracks failures and locks the account after 5 attempts", async () => {
    const email = `${uid("lock")}@test.local`;
    await db.user.create({ data: { name: "Lock Test", email, mobile: `97${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, passwordHash: await hashPassword("Right123"), role: "STUDENT", student: { create: { name: "Lock Test", mobile: "0" } } } });
    for (let i = 0; i < 5; i++) {
      await expect(login({ identifier: email, password: "wrong" })).rejects.toMatchObject({ status: 401 });
    }
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    expect(u.failedLoginCount).toBe(5);
    expect(u.lockedUntil && u.lockedUntil > new Date()).toBe(true);
    await expect(login({ identifier: email, password: "Right123" })).rejects.toThrow(/locked/i);
    const failures = await db.loginHistory.count({ where: { userId: u.id, success: false } });
    expect(failures).toBeGreaterThanOrEqual(6);
  });

  it("rejects duplicate registrations and weak passwords with field errors", async () => {
    const mobile = `96${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    await registerStudent({ name: "Dup One", mobile, password: "Secret123" });
    await expect(registerStudent({ name: "Dup Two", mobile, password: "Secret123" })).rejects.toMatchObject({ status: 422 });
    await expect(registerStudent({ name: "Weak", mobile: `95${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, password: "short" })).rejects.toMatchObject({ status: 422 });
  });

  it("creates password reset tokens and rejects invalid ones", async () => {
    const email = `${uid("reset")}@test.local`;
    const user = await db.user.create({ data: { name: "Reset Test", email, mobile: `94${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, passwordHash: await hashPassword("Right123"), role: "STUDENT" } });
    await requestPasswordReset(email);
    const rows = await db.passwordReset.findMany({ where: { userId: user.id } });
    expect(rows.length).toBe(1);
    await expect(resetPassword("not-a-real-token-value", "NewPass123")).rejects.toMatchObject({ status: 400 });
  });

  it("resolves staff permissions from role and direct grants", async () => {
    await ensurePermissions();
    const role = await db.role.create({ data: { name: `Role ${uid()}`, slug: uid("role") } });
    const view = await db.permission.findUniqueOrThrow({ where: { key: "students.view" } });
    const approve = await db.permission.findUniqueOrThrow({ where: { key: "applications.approve" } });
    await db.rolePermission.create({ data: { roleId: role.id, permissionId: view.id } });
    const user = await db.user.create({ data: { name: "Staff Test", email: `${uid("staff")}@test.local`, mobile: `93${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, passwordHash: await hashPassword("Right123"), role: "STAFF", staff: { create: { employeeCode: uid("EMP").toUpperCase(), roleId: role.id } } }, include: { staff: true } });
    await db.staffPermission.create({ data: { staffId: user.staff!.id, permissionId: approve.id } });
    const { token } = await login({ identifier: user.email!, password: "Right123" });
    const session = await resolveSessionByToken(token);
    expect(session?.permissions.sort()).toEqual(["applications.approve", "students.view"]);
    expect(hasPermission(session, "students.view")).toBe(true);
    expect(hasPermission(session, "payments.verify")).toBe(false);
    expect(hasPermission(session, ["payments.verify", "applications.approve"])).toBe(true);
    expect(hasPermission({ role: "SUPER_ADMIN", permissions: ["*"] }, "anything.at_all")).toBe(true);
    expect(hasPermission({ role: "TRAINER", permissions: ["students.view"] }, "students.view")).toBe(false);
  });
});
