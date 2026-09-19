import { requireAdmin } from "@/lib/auth/guards";
import { getBranding } from "@/lib/settings";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/portal/shell";
import { ADMIN_BOTTOM_NAV, ADMIN_NAV } from "@/components/admin/nav";
import { titleCase } from "@/lib/utils";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [branding, unread] = await Promise.all([
    getBranding(),
    db.notification.count({ where: { userId: user.id, channel: "IN_APP", readAt: null } }),
  ]);
  return (
    <PortalShell
      nav={ADMIN_NAV}
      bottomNav={ADMIN_BOTTOM_NAV}
      user={{ name: user.name, role: user.role, subtitle: user.role === "SUPER_ADMIN" ? "Super Admin" : (user.staff?.roleName ?? titleCase(user.role)), avatarUrl: user.avatarUrl, permissions: user.permissions }}
      branding={branding}
      portalLabel="Foundation Admin"
      homeHref="/admin/dashboard"
      unreadCount={unread}
      notificationsHref="/admin/notifications?tab=inbox"
      settingsHref="/admin/account"
    >
      {children}
    </PortalShell>
  );
}
