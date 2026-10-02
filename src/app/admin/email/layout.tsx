import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { LinkTabs } from "@/components/ui/tabs";

/** Admin → Send Email: Compose | Sent | Drafts | Templates, each shown only to those who may open it. */
export default async function EmailLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin(["email.send", "email.view", "email.templates"]);
  const canSend = hasPermission(user, "email.send");
  const canView = hasPermission(user, ["email.view", "email.send"]);
  const canTemplates = hasPermission(user, ["email.send", "email.templates"]);
  const items = [
    { href: "/admin/email", label: "Compose", exact: true, show: canSend },
    { href: "/admin/email/history", label: "Sent", show: canView },
    { href: "/admin/email/drafts", label: "Drafts", show: canSend },
    { href: "/admin/email/templates", label: "Templates", show: canTemplates },
  ].filter((t) => t.show);
  return (
    <div>
      <LinkTabs className="mb-6" items={items.map(({ href, label, exact }) => ({ href, label, exact }))} />
      {children}
    </div>
  );
}
