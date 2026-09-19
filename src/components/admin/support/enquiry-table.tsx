"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { Drawer } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/misc";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDateTime, titleCase, truncate } from "@/lib/utils";

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
      <TableWrap>
        <THead>
          <tr>
            <TH>Received</TH>
            <TH>From</TH>
            <TH>Type</TH>
            <TH>Subject / message</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </tr>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={6}>No enquiries match these filters.</EmptyRow>
          ) : (
            items.map((e) => (
              <TR key={e.id}>
                <TD className="whitespace-nowrap text-muted">{formatDateTime(e.createdAt)}</TD>
                <TD>
                  <p className="font-medium text-ink">{e.name}</p>
                  <p className="text-xs text-muted">{[e.mobile, e.email].filter(Boolean).join(" · ")}</p>
                </TD>
                <TD>
                  <Badge tone="navy">{titleCase(e.type)}</Badge>
                </TD>
                <TD className="max-w-md">
                  {e.subject && <p className="font-medium text-ink">{e.subject}</p>}
                  <p className="text-xs text-muted">{truncate(e.message, 120)}</p>
                </TD>
                <TD>
                  <StatusBadge status={e.status} />
                </TD>
                <TD className="text-right">
                  <Button size="xs" variant="outline" onClick={() => open(e)} leftIcon={<Reply className="h-3.5 w-3.5" />}>
                    {canRespond ? (e.response ? "View / update" : "Respond") : "View"}
                  </Button>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </TableWrap>

      <Drawer open={!!active} onClose={() => !busy && setActive(null)} title={active?.subject || "Enquiry"} description={active ? `${titleCase(active.type)} enquiry · ${formatDateTime(active.createdAt)}` : undefined}>
        {active && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <KeyValue label="Name" value={active.name} />
              <KeyValue label="Status" value={<StatusBadge status={active.status} />} />
              <KeyValue label="Mobile" value={<a href={`tel:${active.mobile}`} className="text-navy hover:underline">{active.mobile}</a>} />
              <KeyValue label="Email" value={active.email ? <a href={`mailto:${active.email}`} className="text-navy hover:underline">{active.email}</a> : "—"} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">Message</p>
              <p className="rounded-xl bg-surface p-3 text-sm whitespace-pre-line text-ink">{active.message}</p>
            </div>
            {active.response && active.respondedAt && (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">Previous response · {formatDateTime(active.respondedAt)}</p>
                <p className="rounded-xl border border-line p-3 text-sm whitespace-pre-line text-ink">{active.response}</p>
              </div>
            )}
            {canRespond ? (
              <form onSubmit={submit} className="space-y-4 border-t border-line pt-4" noValidate>
                {formError && <Alert tone="danger">{formError}</Alert>}
                <Field label="Response" htmlFor="enq-response" error={errors.response} hint={active.email || active.mobile ? "Sent to the enquirer by email/SMS where enabled." : undefined}>
                  <Textarea id="enq-response" value={response} onChange={(e) => setResponse(e.target.value)} rows={5} invalid={!!errors.response} placeholder={`Dear ${active.name}, …`} />
                </Field>
                <Field label="Set status" htmlFor="enq-status" error={errors.status}>
                  <Select id="enq-status" value={status} onChange={(e) => setStatus(e.target.value)} options={["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => ({ value: s, label: titleCase(s) }))} />
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
      </Drawer>
    </>
  );
}
