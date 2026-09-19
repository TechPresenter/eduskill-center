"use client";

import * as React from "react";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { ReasonDialog } from "@/components/admin/pickers/reason-dialog";
import { useMutation } from "@/components/admin/pickers/use-mutation";

interface DocumentActionsProps {
  /** POST endpoint accepting `{ status: "VERIFIED" | "REJECTED", remarks? }`. */
  endpoint: string;
  url: string;
  name: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  canDecide: boolean;
}

/** View / verify / reject controls for one uploaded document. */
export function DocumentActions({ endpoint, url, name, status, canDecide }: DocumentActionsProps) {
  const { busy, fieldErrors, run } = useMutation();
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const disabledTitle = canDecide ? undefined : "You do not have permission to verify documents";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-ink hover:bg-surface" aria-label={`View ${name}`}>
        <ExternalLink className="h-3.5 w-3.5" /> View
      </a>
      {status !== "VERIFIED" && (
        <Button size="xs" variant="secondary" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => setVerifyOpen(true)} disabled={!canDecide || busy} title={disabledTitle}>
          Verify
        </Button>
      )}
      {status !== "REJECTED" && (
        <Button size="xs" variant="ghost" className="text-danger hover:bg-danger-light" leftIcon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setRejectOpen(true)} disabled={!canDecide || busy} title={disabledTitle}>
          Reject
        </Button>
      )}
      <ConfirmDialog
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        title="Verify document"
        description={`Mark "${name}" as verified? The student will see the document as accepted.`}
        confirmLabel="Verify"
        loading={busy}
        onConfirm={async () => {
          const r = await run(() => api.post(endpoint, { status: "VERIFIED" }), { success: "Document verified" });
          if (r !== undefined) setVerifyOpen(false);
        }}
      />
      <ReasonDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject document"
        description={`Tell the student what is wrong with "${name}" so they can re-upload it.`}
        label="Remarks for the student"
        placeholder="e.g. The image is blurry – please upload a clear scan."
        confirmLabel="Reject document"
        danger
        loading={busy}
        error={fieldErrors.remarks}
        onConfirm={async (remarks) => {
          const r = await run(() => api.post(endpoint, { status: "REJECTED", remarks }), { success: "Document rejected" });
          if (r !== undefined) setRejectOpen(false);
        }}
      />
    </div>
  );
}
