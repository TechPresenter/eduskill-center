import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate } from "@/lib/utils";
import { listTemplates, TEMPLATE_CHANNELS } from "@/server/notifications-admin";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";

export const metadata = { title: "Notification Templates" };

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", SMS: "SMS", WHATSAPP: "WhatsApp", IN_APP: "In-app" };

export default async function TemplatesPage() {
  const user = await requireAdmin(["notifications.view", "notifications.templates"]);
  const templates = await listTemplates();
  const canEdit = hasPermission(user, "notifications.templates");
  const customised = templates.flatMap((t) => t.channels).filter((c) => c.custom).length;

  return (
    <div>
      <PageHeader title="Templates" description={`Wording for every automatic message, per channel. ${customised} of ${templates.length * TEMPLATE_CHANNELS.length} templates are customised; the rest use the built-in defaults.`} />
      {!canEdit && <Alert tone="info" className="mb-4">You can preview templates but need the &ldquo;Manage Templates&rdquo; permission to change them.</Alert>}
      <TableWrap>
        <THead>
          <tr>
            <TH>Event</TH>
            {TEMPLATE_CHANNELS.map((c) => (
              <TH key={c}>{CHANNEL_LABEL[c] ?? c}</TH>
            ))}
          </tr>
        </THead>
        <TBody>
          {templates.map((t) => (
            <TR key={t.event}>
              <TD>
                <span className="block font-semibold text-ink">{t.name}</span>
                <span className="block font-mono text-[11px] text-muted">{t.event}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {t.variables.map((v) => (
                    <span key={v} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-navy">{`{{${v}}}`}</span>
                  ))}
                </span>
              </TD>
              {t.channels.map((c) => (
                <TD key={c.key}>
                  <Link href={`/admin/notifications/templates/${encodeURIComponent(c.key)}`} className="group inline-flex flex-col gap-1 rounded-lg border border-line px-3 py-2 text-xs hover:border-navy/40 hover:bg-surface" aria-label={`${canEdit ? "Edit" : "View"} ${CHANNEL_LABEL[c.channel]} template for ${t.name}`}>
                    <span className="font-semibold text-navy group-hover:underline">{canEdit ? "Edit" : "View"}</span>
                    <span className="flex flex-wrap gap-1">
                      {c.custom ? <Badge tone="orange">Custom</Badge> : <Badge tone="neutral">Default</Badge>}
                      {!c.isActive && <Badge tone="warning">Inactive</Badge>}
                    </span>
                    {c.updatedAt && <span className="text-[11px] text-muted">{formatDate(c.updatedAt)}</span>}
                  </Link>
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </TableWrap>
    </div>
  );
}
