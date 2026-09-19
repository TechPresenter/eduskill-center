import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { LinkTabs } from "@/components/ui/tabs";

export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const canView = hasPermission(user, "notifications.view");
  const canSend = hasPermission(user, "notifications.send");
  const canTemplates = hasPermission(user, ["notifications.view", "notifications.templates"]);
  const items = [
    { href: "/admin/notifications/inbox", label: "Inbox", show: true },
    { href: "/admin/notifications/log", label: "Sent log", show: canView },
    { href: "/admin/notifications/templates", label: "Templates", show: canTemplates },
    { href: "/admin/notifications/announcements", label: "Announcements", show: canView },
    { href: "/admin/notifications/send", label: "Send message", show: canSend },
  ].filter((t) => t.show);
  return (
    <div>
      <LinkTabs className="mb-6" items={items.map(({ href, label }) => ({ href, label }))} />
      {children}
    </div>
  );
}
