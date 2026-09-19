"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { formatINR } from "@/lib/utils";

export function DonationActions({ donation }: { donation: { id: string; donationNo: string; status: string; gateway: string; amount: number; donorDisplay: string; campaign: string | null } }) {
  const router = useRouter();
  const [target, setTarget] = React.useState<"COMPLETED" | "FAILED" | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (donation.gateway !== "manual" || donation.status === "COMPLETED") return <span className="text-xs text-muted">{donation.gateway !== "manual" ? "Gateway managed" : "—"}</span>;

  const run = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/admin/donations/${donation.id}/status`, { status: target, note: note || null });
      toast.success(target === "COMPLETED" ? "Donation marked completed" : "Donation marked failed");
      setTarget(null);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Button size="xs" variant="outline" onClick={() => setTarget("COMPLETED")} leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}>
        Mark completed
      </Button>
      {donation.status !== "FAILED" && (
        <Button size="xs" variant="ghost" className="text-danger hover:bg-danger-light" onClick={() => setTarget("FAILED")} leftIcon={<XCircle className="h-3.5 w-3.5" />}>
          Mark failed
        </Button>
      )}
      <Modal open={!!target} onClose={() => !busy && setTarget(null)} title={target === "COMPLETED" ? "Mark donation as completed?" : "Mark donation as failed?"} size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
          className="space-y-4"
          noValidate
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <p className="text-sm text-muted">
            {donation.donationNo} · {formatINR(donation.amount)} from {donation.donorDisplay}
            {donation.campaign ? ` · ${donation.campaign}` : ""}.
            {target === "COMPLETED" ? " The amount will be added to the campaign total. This cannot be undone." : " The donor's payment did not arrive."}
          </p>
          <Field label="Reference / note (optional)" htmlFor="dn-note">
            <Input id="dn-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. UTR 1234567890 received on 12 Sep" />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant={target === "FAILED" ? "danger" : "primary"} loading={busy}>
              {target === "COMPLETED" ? "Mark completed" : "Mark failed"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
