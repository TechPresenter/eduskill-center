import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getTemplate } from "@/server/notifications-admin";
import { PageHeader } from "@/components/ui/misc";
import { TemplateEditor } from "@/components/admin/notifications/template-editor";

export const metadata = { title: "Edit Template" };

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", SMS: "SMS", WHATSAPP: "WhatsApp", IN_APP: "In-app" };

export default async function TemplateEditPage({ params }: { params: Promise<{ key: string }> }) {
  const user = await requireAdmin(["notifications.view", "notifications.templates"]);
  const { key } = await params;
  const template = await getTemplate(decodeURIComponent(key)).catch(() => null);
  if (!template) notFound();
  const channel = CHANNEL_LABEL[template.channel] ?? template.channel;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Templates", href: "/admin/notifications/templates" }, { label: template.name }, { label: channel }]}
        title={`${template.name} · ${channel}`}
        description={template.channel === "SMS" || template.channel === "WHATSAPP" ? "Keep it short – long messages are split into several SMS segments." : "Use the variables below; they are replaced with live data when the message is sent."}
      />
      <TemplateEditor template={template} canEdit={hasPermission(user, "notifications.templates")} />
    </div>
  );
}
