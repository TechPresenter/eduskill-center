import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { listEmailTemplates } from "@/server/email";
import { TemplateManager } from "@/components/admin/email/template-manager";

export const metadata = { title: "Email Templates" };

export default async function EmailTemplatesPage() {
  const user = await requireAdmin(["email.send", "email.templates"]);
  const { starters, templates } = await listEmailTemplates();
  return (
    <TemplateManager
      canManage={hasPermission(user, "email.templates")}
      canSend={hasPermission(user, "email.send")}
      starters={starters.map((t) => ({ id: t.id, name: t.name, subject: t.subject, html: t.html }))}
      templates={templates.map((t) => ({ id: t.id, name: t.name, description: t.description, subject: t.subject, html: t.html, isActive: t.isActive, updatedAt: t.updatedAt.toISOString() }))}
    />
  );
}
