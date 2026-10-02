import { db } from "@/lib/db";
import { adminIdleMs } from "@/lib/auth/policy";

/** The signed-in administrator's own profile (My account → Profile). */
export async function accountProfile(userId: string) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, mobile: true, role: true, status: true, avatarUrl: true, lastLoginAt: true, createdAt: true, emailVerifiedAt: true, staff: { select: { employeeCode: true, designation: true, department: true, role: { select: { name: true, description: true } } } } },
  });
}

/**
 * The administrator's own sessions that can still be used. A session idle for longer than the admin
 * inactivity limit, or one without a verified second factor while 2FA applies to the account, is
 * refused on its next request (resolveSessionByToken) — it is not "signed in", so it is not listed.
 */
export async function accountSessions(userId: string, currentSessionId: string, opts: { needsMfa: boolean }) {
  const rows = await db.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      OR: [{ id: currentSessionId }, { lastSeenAt: { gt: new Date(Date.now() - adminIdleMs()) }, ...(opts.needsMfa ? { mfaAt: { not: null } } : {}) }],
    },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true, authMethod: true, mfaAt: true },
  });
  return rows.map((s) => ({ ...s, current: s.id === currentSessionId }));
}

/** The administrator's own latest sign-in attempts. The typed identifier is not selected. */
export async function accountLoginHistory(userId: string, take = 20) {
  return db.loginHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, success: true, reason: true, method: true, ip: true, userAgent: true, newDevice: true, suspicious: true, createdAt: true },
  });
}
