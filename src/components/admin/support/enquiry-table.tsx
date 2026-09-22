"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Handshake, HandCoins, HelpCircle, Mail, MessageSquare, Reply, School, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/tabs";
import { Field } from "@/components/ui/form";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Alert } from "@/components/ui/feedback";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/misc";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDate, formatDateTime, titleCase, truncate } from "@/lib/utils";
import { AppList, AppListRow, IconTile, type TileTone } from "@/components/admin/content/app-list";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = { GENERAL: MessageSquare, ADMISSION: School, VOLUNTEER: UserPlus, PARTNERSHIP: Handshake, DONATION: HandCoins, OTHER: HelpCircle };
const STATUS_TILE: Record<string, TileTone> = { NEW: "orange", IN_PROGRESS: "info", RESOLVED: "success", CLOSED: "neutral" };

export interface EnquiryRow {
  id: string;
  name: string;
  email: string | null;
  mobile: string;
  subject: string | null;
  message: string;
  type: string;
  status: string;
  response: string | null;
  respondedAt: string | Date | null;
  createdAt: string | Date;
}

export function EnquiryTable({ items, canRespond }: { items: EnquiryRow[]; canRespond: boolean }) {
  const router = useRouter();
  const [active, setActive] = React.useState<EnquiryRow | null>(null);
  const [response, setResponse] = React.useState("");
  const [status, setStatus] = React.useState("RESOLVED");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const open = (e: EnquiryRow) => {
    setActive(e);
    setResponse(e.response ?? "");
    setStatus(e.status === "NEW" ? "RESOLVED" : e.status);
    setErrors({});
    setFormError(null);
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!active) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await api.post(`/api/admin/support/enquiries/${active.id}`, { response, status });
      toast.success("Enquiry updated", response.trim() ? `${active.name} has been sent your response.` : undefined);
      setActive(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Phones: inbox-style rows; new enquiries stand out. */}
      <div className="md:hidden">
        {items.length === 0 ? (
          <AppList aria-label="Enquiries">
            <li className="px-4 py-8 text-center text-body-sm text-muted">No enquiries match these filters.</li>
          </AppList>
        ) : (
          <AppList aria-label="Enquiries">
            {items.map((e) => {
              const Icon = TYPE_ICON[e.type] ?? Mail;
              return (
                <AppListRow
                  key={e.id}
                  onClick={() => open(e)}
                  aria-label={`Open enquiry from ${e.name}`}
                  highlight={e.status === "NEW"}
                  leading={
                    <IconTile tone={STATUS_TILE[e.status] ?? "lavender"}>
                      <Icon />
                    </IconTile>
                  }
                  title={e.subject || e.name}
                  subtitle={e.subject ? `${e.name} · ${truncate(e.message, 90)}` : truncate(e.message, 110)}
                  meta={
                    <>
                      <StatusBadge status={e.status} />
                      <Badge tone="navy">{titleCase(e.type)}</Badge>
                    </>
                  }
                  trailing={<span className="tabular-nums">{formatDate(e.createdAt, "dd MMM")}</span>}
                />
              );
            })}
          </AppList>
        )}
      </div>

      <div className="hidden md:block">
        <TableWrap cards={false}>
          <THead>
            <tr>
              <TH>Received</TH>
              <TH>From</TH>
              <TH>Type</TH>
              <TH>Subject / message</TH>
              <TH>Status</TH>
              <TH className="text-right">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {items.length === 0 ? (
              <EmptyRow colSpan={6}>No enquiries match these filters.</EmptyRow>
            ) : (
              items.map((e) => (
                <TR key={e.id} className={e.status === "NEW" ? "bg-orange-light/30" : undefined}>
                  <TD className="whitespace-nowrap text-muted tabular-nums">{formatDateTime(e.createdAt)}</TD>
                  <TD>
                    <p className="font-medium text-ink">{e.name}</p>
                    <p className="text-caption text-muted">{[e.mobile, e.email].filter(Boolean).join(" · ")}</p>
                  </TD>
                  <TD>
                    <Badge tone="navy">{titleCase(e.type)}</Badge>
                  </TD>
                  <TD className="max-w-md">
                    {e.subject && <p className="font-medium text-ink">{e.subject}</p>}
                    <p className="text-caption text-muted">{truncate(e.message, 120)}</p>
                  </TD>
                  <TD>
                    <StatusBadge status={e.status} />
                  </TD>
                  <TD className="text-right">
                    <Button size="sm" variant="outline" onClick={() => open(e)} leftIcon={<Reply className="h-4 w-4" />}>
                      {canRespond ? (e.response ? "View / update" : "Respond") : "View"}
                    </Button>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </TableWrap>
      </div>

      <BottomSheet open={!!active} onClose={() => !busy && setActive(null)} desktop="drawer" size="lg" title={active?.subject || "Enquiry"} description={active ? `${titleCase(active.type)} enquiry · ${formatDateTime(active.createdAt)}` : undefined}>
        {active && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <KeyValue label="Name" value={active.name} />
              <KeyValue label="Status" value={<StatusBadge status={active.status} />} />
              <KeyValue label="Mobile" value={<a href={`tel:${active.mobile}`} className="inline-flex min-h-11 items-center text-navy tabular-nums hover:underline md:min-h-0">{active.mobile}</a>} />
              <KeyValue label="Email" value={active.email ? <a href={`mailto:${active.email}`} className="inline-flex min-h-11 items-center break-all text-navy hover:underline md:min-h-0">{active.email}</a> : "—"} />
            </div>
            <div>
              <p className="mb-1.5 text-overline text-muted">Message</p>
              <p className="rounded-card rounded-tl-sm bg-surface p-4 text-body-sm break-words whitespace-pre-line text-ink">{active.message}</p>
            </div>
            {active.response && active.respondedAt && (
              <div>
                <p className="mb-1.5 text-overline text-muted">Your response · {formatDateTime(active.respondedAt)}</p>
                <p className="rounded-card rounded-tr-sm bg-navy p-4 text-body-sm break-words whitespace-pre-line text-white">{active.response}</p>
              </div>
            )}
            {canRespond ? (
              <form onSubmit={submit} className="space-y-4 border-t border-line pt-4" noValidate>
                {formError && <Alert tone="danger">{formError}</Alert>}
                <Field label="Response" htmlFor="enq-response" error={errors.response} hint={active.email || active.mobile ? "Sent to the enquirer by email/SMS where enabled." : undefined}>
                  <Textarea id="enq-response" value={response} onChange={(e) => setResponse(e.target.value)} rows={5} invalid={!!errors.response} placeholder={`Dear ${active.name}, …`} />
                </Field>
                <Field label="Set status" error={errors.status}>
                  <SegmentedControl fullWidth scrollable value={status} onChange={setStatus} items={["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => ({ value: s, label: titleCase(s) }))} />
                </Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setActive(null)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={busy}>
                    {response.trim() ? "Send response" : "Update status"}
                  </Button>
                </div>
              </form>
            ) : (
              <Alert tone="info">You need the &ldquo;Respond&rdquo; permission to reply to enquiries.</Alert>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
