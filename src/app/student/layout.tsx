import { requireStudent } from "@/lib/auth/guards";
import { getBranding } from "@/lib/settings";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/portal/shell";
import { STUDENT_BOTTOM_NAV, STUDENT_NAV } from "@/components/student/nav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();
  const [branding, unread] = await Promise.all([
    getBranding(),
    db.notification.count({ where: { userId: user.id, channel: "IN_APP", readAt: null } }),
  ]);
  return (
    <PortalShell
      nav={STUDENT_NAV}
      bottomNav={STUDENT_BOTTOM_NAV}
      user={{ name: user.name, role: "Student", subtitle: user.student.studentId ?? "Student ID pending", avatarUrl: user.avatarUrl }}
      branding={branding}
      portalLabel="Student Portal"
      homeHref="/student/dashboard"
      unreadCount={unread}
      notificationsHref="/student/notifications"
      profileHref="/student/profile"
      settingsHref="/student/settings"
    >
      {children}
    </PortalShell>
  );
}
