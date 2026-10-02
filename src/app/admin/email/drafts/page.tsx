import Link from "next/link";
import { FilePen, Paperclip, PenLine, SearchX, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { paginationSchema } from "@/lib/api/query";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { listEmails } from "@/server/email";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { Pager } from "@/components/admin/pickers/pager";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { AppList, AppListRow, IconTile } from "@/components/admin/content/app-list";
import { flattenSearchParams, parseListQuery, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Email Drafts" };

function recipientsLine(to: string[], cc: string[], bcc: string[]) {
  const all = to.length + cc.length + bcc.length;
  if (!all) return "No recipients yet";
  const first = to[0] ?? cc[0] ?? bcc[0];
  return all > 1 ? `${first} +${all - 1} more` : first!;
}

function DeleteDraft({ id, subject, compact }: { id: string; subject: string; compact?: boolean }) {
  return (
    <ConfirmAction
      title="Delete this draft?"
      description={`“${subject}” will be removed from your drafts. This cannot be undone.`}
      confirmLabel="Delete draft"
      danger
      method="delete"
      url={`/api/admin/email/drafts/${id}`}
      successMessage="Draft deleted"
      icon={<Trash2 className="h-4 w-4" aria-hidden />}
      className={compact ? "max-sm:w-11 max-sm:px-0" : undefined}
    >
      <span className={compact ? "max-sm:sr-only" : undefined}>Delete</span>
    </ConfirmAction>
  );
}

/** Your unsent drafts (a Super Admin sees every administrator's drafts). */
export default async function EmailDraftsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("email.send");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(paginationSchema, sp);
  const data = await listEmails({ ...q, scope: "drafts" }, { user });
  const base = "/admin/email/drafts";
  const filtered = Object.keys(sp).some((k) => k !== "page");
  const isEmpty = data.meta.total === 0 && !filtered;
  const showAuthor = user.role === "SUPER_ADMIN";

  return (
    <AdminListPage
      header={{
        title: "Drafts",
        mobileTitle: "Email drafts",
        description: `${formatNumber(data.meta.total)} unsent draft${data.meta.total === 1 ? "" : "s"}${showAuthor ? " across all administrators" : ""}. Drafts are private to the administrator who wrote them.`,
        actions: (
          <ButtonLink href="/admin/email" leftIcon={<PenLine className="h-4 w-4" />}>
            Compose
          </ButtonLink>
        ),
      }}
      fab={{ href: "/admin/email", label: "Compose email", icon: <PenLine className="h-6 w-6" aria-hidden /> }}
      filters={isEmpty ? undefined : <FilterBar fields={[{ type: "search", placeholder: "Subject or exact recipient address" }]} />}
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
    >
      {isEmpty ? (
        <EmptyState
          icon={<FilePen className="h-7 w-7" />}
          title="No drafts"
          description="Use “Save draft” in Compose to keep an email for later. It stays here until you send or delete it."
          action={
            <ButtonLink href="/admin/email" variant="navy" size="md">
              Write an email
            </ButtonLink>
          }
        />
      ) : data.items.length === 0 ? (
        <EmptyState size="sm" icon={<SearchX className="h-6 w-6" />} title="No drafts match" description="Try another search term." action={<ButtonLink href={base} variant="outline" size="sm">Clear search</ButtonLink>} />
      ) : (
        <>
          <AppList aria-label="Email drafts" className="md:hidden">
            {data.items.map((d) => (
              <AppListRow
                key={d.id}
                href={`/admin/email?draft=${d.id}`}
                aria-label={`Open draft: ${d.subject}`}
                leading={
                  <IconTile tone="lavender">
                    <FilePen />
                  </IconTile>
                }
                title={d.subject}
                subtitle={recipientsLine(d.toAddresses, d.ccAddresses, d.bccAddresses)}
                clamp={1}
                meta={
                  <>
                    {showAuthor && <Badge tone="navy">{d.createdBy}</Badge>}
                    {d.attachments.length > 0 && (
                      <Badge tone="neutral">
                        <Paperclip className="h-3 w-3" aria-hidden />
                        {d.attachments.length}
                        <span className="sr-only"> attachment{d.attachments.length === 1 ? "" : "s"}</span>
                      </Badge>
                    )}
                  </>
                }
                trailing={<span className="tabular-nums">{formatDate(d.updatedAt, "dd MMM")}</span>}
                actions={<DeleteDraft id={d.id} subject={d.subject} compact />}
              />
            ))}
          </AppList>

          <div className="hidden md:block">
            <TableWrap cards={false}>
              <THead>
                <tr>
                  <TH>Subject</TH>
                  <TH>Recipients</TH>
                  {showAuthor && <TH>Written by</TH>}
                  <TH>Last saved</TH>
                  <TH className="text-right">Files</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {data.items.map((d) => (
                  <TR key={d.id}>
                    <TD className="max-w-md">
                      <Link href={`/admin/email?draft=${d.id}`} className="ring-focus block rounded-xs font-medium text-ink hover:text-navy hover:underline">
                        {d.subject}
                      </Link>
                    </TD>
                    <TD className="max-w-[16rem] truncate text-ink">{recipientsLine(d.toAddresses, d.ccAddresses, d.bccAddresses)}</TD>
                    {showAuthor && <TD className="whitespace-nowrap text-ink">{d.createdBy}</TD>}
                    <TD className="whitespace-nowrap text-muted tabular-nums">{formatDateTime(d.updatedAt)}</TD>
                    <TD className="text-right text-muted tabular-nums">
                      {d.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="h-3.5 w-3.5" aria-hidden />
                          {d.attachments.length}
                          <span className="sr-only"> attachment{d.attachments.length === 1 ? "" : "s"}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="text-right">
                      <span className="inline-flex items-center gap-2">
                        <ButtonLink href={`/admin/email?draft=${d.id}`} variant="outline" size="sm" leftIcon={<PenLine className="h-4 w-4" aria-hidden />}>
                          Open
                        </ButtonLink>
                        <DeleteDraft id={d.id} subject={d.subject} />
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </div>
        </>
      )}
    </AdminListPage>
  );
}
