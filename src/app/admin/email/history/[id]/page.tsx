import { notFound, redirect } from "next/navigation";
import { FileText, Mail, MailCheck, MailX, Paperclip } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { fileUrl } from "@/lib/storage";
import { formatBytes, formatDateTime, isUuid } from "@/lib/utils";
import { getEmail } from "@/server/email";
import { PageHeader, KeyValue } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { IconTile } from "@/components/admin/content/app-list";
import { CopyButton } from "@/components/admin/shared/copy-button";
import { EmailPreviewTabs } from "@/components/admin/email/email-preview";
import { DuplicateEmailButton } from "@/components/admin/email/duplicate-email-button";

export const metadata = { title: "Sent Email" };

function AddressList({ label, list, hidden }: { label: string; list: string[]; hidden?: boolean }) {
  if (!list.length) return null;
  return (
    <div>
      <p className="text-caption font-semibold tracking-wide text-muted uppercase">
        {label} <span className="font-normal normal-case tabular-nums">({list.length})</span>
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`${label} recipients`}>
        {list.map((a) => (
          <li key={a} className="max-w-full truncate rounded-full bg-lavender px-2.5 py-0.5 text-sm font-medium text-navy">
            {a}
          </li>
        ))}
      </ul>
      {hidden && <p className="mt-1 text-caption text-muted">Hidden from the other recipients.</p>}
    </div>
  );
}

export default async function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(["email.view", "email.send"]);
  const { id } = await params;
  if (!isUuid(id)) notFound();

  let m: Awaited<ReturnType<typeof getEmail>>;
  try {
    m = await getEmail(id, { user });
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) redirect("/admin/forbidden");
    notFound();
  }
  if (m.status === "DRAFT") redirect(`/admin/email?draft=${m.id}`);

  const canSend = hasPermission(user, "email.send");
  const total = m.toAddresses.length + m.ccAddresses.length + m.bccAddresses.length;
  const attachmentBytes = m.attachments.reduce((s, a) => s + a.size, 0);
  const StatusIcon = m.status === "SENT" ? MailCheck : m.status === "FAILED" ? MailX : Mail;
  const sender = m.sentBy ?? m.createdBy;
  const duplicate = canSend ? (
    <DuplicateEmailButton
      userId={user.id}
      source={{
        to: m.toAddresses,
        cc: m.ccAddresses,
        bcc: m.bccAddresses,
        subject: m.subject,
        html: m.html,
        includeSignature: m.includeSignature,
        attachments: m.attachments.map((a) => ({ key: a.key, name: a.name, size: a.size, mimeType: a.mimeType })),
        templateId: m.templateId,
        isTest: m.isTest,
      }}
    />
  ) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        mobileTitle="Sent email"
        backHref="/admin/email/history"
        breadcrumbs={[
          { label: "Send Email", href: "/admin/email" },
          { label: "Sent", href: "/admin/email/history" },
          { label: m.subject },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-words">{m.subject}</span>
            <StatusBadge status={m.status} />
            {m.isTest && <Badge tone="info">Test</Badge>}
          </span>
        }
        description={
          <span className="hidden lg:inline">
            {m.sentAt ? `Sent ${formatDateTime(m.sentAt)}` : `Created ${formatDateTime(m.createdAt)}`}
            {sender ? ` by ${sender.name}` : ""} · {total} recipient{total === 1 ? "" : "s"}
          </span>
        }
        actions={duplicate}
      />

      {/* Phones: the subject and state (the app bar shows only "Sent email"). */}
      <Card className="flex items-start gap-3 p-4 lg:hidden">
        <IconTile tone={m.status === "SENT" ? "success" : m.status === "FAILED" ? "danger" : "warning"}>
          <StatusIcon />
        </IconTile>
        <div className="min-w-0 flex-1">
          <h2 className="text-h4 break-words text-navy">{m.subject}</h2>
          <p className="mt-0.5 text-body-sm text-muted">
            {formatDateTime(m.sentAt ?? m.createdAt)}
            {sender ? ` · ${sender.name}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={m.status} />
            {m.isTest && <Badge tone="info">Test</Badge>}
          </div>
        </div>
      </Card>

      {m.status === "FAILED" && (
        <Alert tone="danger" title="This email was not delivered">
          <span className="break-words">{m.error ?? "The mail server refused the message."}</span>
        </Alert>
      )}
      {m.status === "SENT" && m.error && (
        <Alert tone="warning" title="Some addresses were refused">
          <span className="break-words">{m.error}</span>
        </Alert>
      )}
      {m.status === "SENDING" && (
        <Alert tone="info" title="No delivery result was recorded">
          The email was being handed to the mail server when the result was lost. Check the recipient&apos;s inbox before sending it again.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <KeyValue label="From" value={<span className="break-words">{m.fromAddress ?? "—"}</span>} />
              {m.replyTo && <KeyValue label="Reply-To" value={<span className="break-words">{m.replyTo}</span>} />}
              <KeyValue label="Sent by" value={sender ? <span className="break-words">{sender.name}{sender.email ? <span className="block text-caption font-normal text-muted">{sender.email}</span> : null}</span> : "—"} />
              {m.createdBy && m.sentBy && m.createdBy.id !== m.sentBy.id && <KeyValue label="Draft written by" value={m.createdBy.name} />}
              <KeyValue label="Date & time" value={m.sentAt ? formatDateTime(m.sentAt) : "—"} />
              <KeyValue
                label="Delivery status"
                value={
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={m.status} />
                    {m.isTest && <Badge tone="info">Test email</Badge>}
                  </span>
                }
              />
              <KeyValue label="Signature" value={m.includeSignature ? "Included" : "Not included"} />
              <div className="sm:col-span-2 xl:col-span-1">
                <KeyValue
                  label="Message-ID"
                  value={
                    m.messageId ? (
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 font-mono text-caption break-all">{m.messageId}</span>
                        <CopyButton text={m.messageId} label="Copy ID" />
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recipients" description={`${total} address${total === 1 ? "" : "es"}`} />
            <CardBody className="space-y-4">
              <AddressList label="To" list={m.toAddresses} />
              <AddressList label="Cc" list={m.ccAddresses} />
              <AddressList label="Bcc" list={m.bccAddresses} hidden />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Attachments" description={m.attachments.length ? `${m.attachments.length} file${m.attachments.length === 1 ? "" : "s"} · ${formatBytes(attachmentBytes)}` : undefined} />
            <CardBody>
              {m.attachments.length ? (
                <ul className="divide-y divide-line">
                  {m.attachments.map((a) => (
                    <li key={a.key} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-lavender text-navy" aria-hidden>
                        <FileText className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <a href={fileUrl(a.key)} target="_blank" rel="noopener noreferrer" className="ring-focus block truncate rounded-xs text-sm font-semibold text-ink hover:text-navy hover:underline">
                          {a.name}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                        <span className="block text-caption text-muted">
                          {a.mimeType} · {formatBytes(a.size)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-body-sm text-muted">
                  <Paperclip className="h-4 w-4" aria-hidden />
                  No attachments
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <Card className="xl:col-span-2">
          <CardHeader title="Message" description={m.includeSignature ? "The message body as it was sent. The signature was appended below it at the time and is not shown here." : "The message as it was sent."} />
          <CardBody>{m.previewHtml ? <EmailPreviewTabs html={m.previewHtml} text={m.text} label="Sent email" /> : <p className="text-body-sm text-muted">No preview is available.</p>}</CardBody>
        </Card>
      </div>
    </div>
  );
}
