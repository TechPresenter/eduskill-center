"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";

interface Props {
  applicationId: string;
  docId: string;
  name: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  canVerify: boolean;
}

/** Step 2 – Documents Verification: verify / reject one uploaded document with remarks. */
export function CentreDocumentActions({ applicationId, docId, name, status, canVerify }: Props) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [remarks, setRemarks] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!canVerify) return null;

  const send = async (next: "VERIFIED" | "REJECTED") => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/admin/centre-applications/${applicationId}/documents/${docId}/verify`, {
        status: next,
        remarks: next === "REJECTED" ? remarks : null,
      });
      toast.success(next === "VERIFIED" ? "Document verified" : "Document rejected");
      setRejectOpen(false);
      setRemarks("");
      router.refresh();
    } catch (err) {
      const msg = err instanceof ApiClientError ? (err.fieldErrors.remarks ?? err.message) : "Something went wrong";
      if (next === "REJECTED") setError(msg);
      else toast.error("Could not update document", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      {status !== "VERIFIED" && (
        <Button size="xs" variant="outline" className="max-md:min-h-11 max-md:px-3" onClick={() => void send("VERIFIED")} loading={busy && !rejectOpen} leftIcon={<Check className="h-3.5 w-3.5" />}>
          Verify
        </Button>
      )}
      {status !== "REJECTED" && (
        <Button size="xs" variant="ghost" className="text-danger hover:bg-danger-light max-md:min-h-11 max-md:px-3" onClick={() => setRejectOpen(true)} leftIcon={<X className="h-3.5 w-3.5" />}>
          Reject
        </Button>
      )}
      <BottomSheet open={rejectOpen} onClose={() => !busy && setRejectOpen(false)} title="Reject document" description={`${name} – the applicant sees this remark and can upload a replacement.`} size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send("REJECTED");
          }}
          className="space-y-4 pb-2"
          noValidate
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Remarks" htmlFor={`rm-${docId}`} required>
            <Textarea id={`rm-${docId}`} value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} required />
          </Field>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="md" onClick={() => setRejectOpen(false)} disabled={busy} fullWidth className="sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="md" loading={busy} fullWidth className="sm:w-auto">
              Reject document
            </Button>
          </div>
        </form>
      </BottomSheet>
    </span>
  );
}
