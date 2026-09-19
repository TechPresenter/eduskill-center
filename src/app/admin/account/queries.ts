import { db } from "@/lib/db";

export async function accountOverview(userId: string, currentSessionId: string) {
  const [user, sessions, loginHistory] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, mobile: true, role: true, status: true, avatarUrl: true, lastLoginAt: true, createdAt: true, emailVerifiedAt: true, staff: { select: { employeeCode: true, designation: true, department: true, role: { select: { name: true, description: true } } } } },
    }),
    db.session.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true } }),
    db.loginHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  return { user, sessions: sessions.map((s) => ({ ...s, current: s.id === currentSessionId })), loginHistory };
}
