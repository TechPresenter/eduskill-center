import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { listTemplates, TEMPLATE_CHANNELS } from "@/server/notifications-admin";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/feedback";
import { TemplateBrowser } from "@/components/admin/notifications/template-browser";
import { StatStrip } from "@/components/admin/content/app-list";

export const metadata = { title: "Notification Templates" };

export default async function TemplatesPage() {
  const user = await requireAdmin(["notifications.view", "notifications.templates"]);
  const templates = await listTemplates();
  const canEdit = hasPermission(user, "notifications.templates");
  const all = templates.flatMap((t) => t.channels);
  const customised = all.filter((c) => c.custom).length;
  const inactive = all.filter((c) => !c.isActive).length;
  const total = templates.length * TEMPLATE_CHANNELS.length;

  return (
    <div className="space-y-4">
      <PageHeader title="Templates" mobileTitle="Templates" description="The wording of every automatic message, per channel. Anything you have not customised uses the built-in default." />

      <StatStrip
        className="sm:max-w-xl"
        items={[
          { label: "Events", value: templates.length },
          { label: "Custom", value: customised, tone: "orange" },
          { label: "Off", value: inactive, tone: inactive ? "warning" : "muted" },
        ]}
      />
      <p className="text-caption text-muted">
        {customised} of {total} channel templates customised. Orange chips are customised, amber chips are switched off and fall back to the default.
      </p>

      {!canEdit && <Alert tone="info">You can preview templates but need the &ldquo;Manage Templates&rdquo; permission to change them.</Alert>}

      <TemplateBrowser
        canEdit={canEdit}
        templates={templates.map((t) => ({
          event: t.event,
          name: t.name,
          variables: [...t.variables],
          channels: t.channels.map((c) => ({ channel: c.channel, key: c.key, custom: c.custom, isActive: c.isActive, updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null })),
        }))}
      />
    </div>
  );
}
