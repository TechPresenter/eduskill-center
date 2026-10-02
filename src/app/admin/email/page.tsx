import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { fileUrl } from "@/lib/storage";
import { isUuid } from "@/lib/utils";
import { composerConfig, getEmail, listEmailTemplates } from "@/server/email";
import { PageHeader } from "@/components/ui/misc";
import { firstParam } from "@/components/admin/shared/url";
import { EmailComposer, type ComposerInitial, type EmailComposerProps } from "@/components/admin/email/email-composer";
import type { TemplateOption } from "@/components/admin/email/types";

export const metadata = { title: "Send Email" };

/**
 * Compose. `?draft=<id>` reopens one of your drafts (read through the history detail service, which
 * keeps drafts private to their author); `?template=<id>` starts from a starter layout or a saved
 * template.
 */
export default async function ComposeEmailPage({ searchParams }: { searchParams: Promise<{ draft?: string | string[]; template?: string | string[] }> }) {
  const user = await requireAdmin(["email.send", "email.view", "email.templates"]);
  if (!hasPermission(user, "email.send")) redirect(hasPermission(user, "email.view") ? "/admin/email/history" : "/admin/email/templates");

  const sp = await searchParams;
  const draftParam = firstParam(sp.draft);
  const templateParam = firstParam(sp.template);
  const [config, library] = await Promise.all([composerConfig(), listEmailTemplates()]);

  const starters: TemplateOption[] = library.starters.map((t) => ({ id: t.id, name: t.name, subject: t.subject, html: t.html, starter: true }));
  const templates: TemplateOption[] = library.templates
    .filter((t) => t.isActive)
    .map((t) => ({ id: t.id, name: t.name, subject: t.subject, html: t.html, description: t.description, starter: false, isActive: t.isActive }));

  let initial: ComposerInitial = { draftId: null, to: [], cc: [], bcc: [], subject: "", html: "", includeSignature: config.signatureDefault, attachments: [], templateId: null, savedAt: null };
  let notice: EmailComposerProps["notice"] = null;

  if (draftParam) {
    const draft = isUuid(draftParam) ? await getEmail(draftParam, { user }).catch(() => null) : null;
    if (draft && draft.status === "DRAFT") {
      initial = {
        draftId: draft.id,
        to: draft.toAddresses,
        cc: draft.ccAddresses,
        bcc: draft.bccAddresses,
        subject: draft.subject,
        html: draft.html,
        includeSignature: draft.includeSignature,
        attachments: draft.attachments.map((a) => ({ key: a.key, name: a.name, size: a.size, mimeType: a.mimeType, url: fileUrl(a.key) })),
        templateId: draft.templateId,
        savedAt: draft.updatedAt.toISOString(),
      };
    } else {
      notice = { tone: "warning", title: "That draft is not available", body: "It may have been sent or deleted already, or it belongs to another administrator. You are writing a new email." };
    }
  } else if (templateParam) {
    const t = [...starters, ...templates].find((x) => x.id === templateParam);
    if (t) initial = { ...initial, subject: t.subject, html: t.html, templateId: t.starter ? null : t.id };
    else notice = { tone: "warning", title: "That template is not available", body: "It may have been deleted or switched off. Choose another one under Message → Start from a template." };
  }

  return (
    <div>
      <PageHeader
        title="Send Email"
        mobileTitle="Compose email"
        description="Write a formatted email, add your signature, preview and test it, then send it through the Foundation's mail account."
      />
      <EmailComposer
        key={draftParam ?? templateParam ?? "new"}
        config={config}
        starters={starters}
        templates={templates}
        initial={initial}
        notice={notice}
        userEmail={user.email}
        canViewHistory={hasPermission(user, "email.view")}
        canEditSignature={hasPermission(user, "settings.update")}
      />
    </div>
  );
}
