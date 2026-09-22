"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";

export function DocumentActions({ docId, status, canUpdate }: { docId: string; status: "PENDING" | "VERIFIED" | "REJECTED"; canUpdate: boolean }) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [remarks, setRemarks] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!canUpdate) return null;

  const send = async (next: "VERIFIED" | "REJECTED") => {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/admin/trainer-applications/documents/${docId}`, { status: next, remarks: next === "REJECTED" ? remarks : null });
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
    <div className="flex items-center gap-1">
      {status !== "VERIFIED" && (
        <Button size="sm" variant="outline" onClick={() => void send("VERIFIED")} loading={busy && !rejectOpen} leftIcon={<Check className="h-3.5 w-3.5" />}>
          Verify
        </Button>
      )}
      {status !== "REJECTED" && (
        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-light" onClick={() => setRejectOpen(true)} leftIcon={<X className="h-3.5 w-3.5" />}>
          Reject
        </Button>
      )}
      <Modal open={rejectOpen} onClose={() => !busy && setRejectOpen(false)} title="Reject document" description="The applicant will see this remark and can upload a replacement." size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send("REJECTED");
          }}
          className="space-y-4"
          noValidate
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Remarks" htmlFor={`rm-${docId}`} required>
            <Textarea id={`rm-${docId}`} value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} required />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              Reject document
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
