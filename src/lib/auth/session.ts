import { cookies } from "next/headers";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { UserRole, TrainerStatus, TrainerLevel } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "esk_session";
const SESSION_DAYS = 7;
const REMEMBER_DAYS = 30;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: UserRole;
  avatarUrl: string | null;
  /** Permission keys. Super Admin receives ["*"]. */
  permissions: string[];
  staff: { id: string; employeeCode: string; roleName: string | null; designation: string | null } | null;
  student: { id: string; studentId: string | null; profileCompleted: boolean } | null;
  trainer: { id: string; trainerId: string; status: TrainerStatus; level: TrainerLevel } | null;
  sessionId: string;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  opts: { ip?: string | null; userAgent?: string | null; remember?: boolean } = {}
) {
  const token = randomBytes(32).toString("base64url");
  const days = opts.remember ? REMEMBER_DAYS : SESSION_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      ip: opts.ip ?? null,
      userAgent: opts.userAgent?.slice(0, 500) ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function resolveSessionByToken(token: string): Promise<AuthUser | null> {
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          staff: {
            include: {
              role: { include: { permissions: { include: { permission: { select: { key: true } } } } } },
              permissions: { include: { permission: { select: { key: true } } } },
            },
          },
          student: { select: { id: true, studentId: true, profileCompleted: true } },
          trainer: { select: { id: true, trainerId: true, status: true, level: true } },
        },
      },
    },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const u = session.user;
  if (u.status !== "ACTIVE" || u.deletedAt) return null;

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    void db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  let permissions: string[] = [];
  if (u.role === "SUPER_ADMIN") {
    permissions = ["*"];
  } else if (u.role === "STAFF" && u.staff && !u.staff.deletedAt) {
    const set = new Set<string>();
    for (const rp of u.staff.role?.permissions ?? []) set.add(rp.permission.key);
    for (const sp of u.staff.permissions) set.add(sp.permission.key);
    permissions = [...set];
  }

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    role: u.role,
    avatarUrl: u.avatarUrl,
    permissions,
    staff:
      u.staff && !u.staff.deletedAt
        ? {
            id: u.staff.id,
            employeeCode: u.staff.employeeCode,
            roleName: u.staff.role?.name ?? null,
            designation: u.staff.designation,
          }
        : null,
    student: u.student,
    trainer: u.trainer,
    sessionId: session.id,
  };
}

/** Current user for this request (memoised per request). */
export const getSessionUser = cache(async (): Promise<AuthUser | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  return resolveSessionByToken(token);
});

export async function revokeSessionByToken(token: string) {
  await db.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

export function portalHome(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "STAFF":
      return "/admin/dashboard";
    case "TRAINER":
      return "/trainer/dashboard";
    case "STUDENT":
    default:
      return "/student/dashboard";
  }
}
