"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";

export function ApplicationActions({ applicationId, status, missingCount, canCancel }: { applicationId: string; status: string; missingCount: number; canCancel: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const isDraft = status === "DRAFT";
  if (!isDraft && !canCancel) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/api/student/applications/${applicationId}/submit`);
      toast.success("Application submitted", "The Foundation will review it and keep you updated.");
      router.refresh();
    } catch (err) {
      toast.error("Could not submit", errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    try {
      await api.post(`/api/student/applications/${applicationId}/cancel`, { reason: reason || null });
      toast.success("Application cancelled");
      setCancelOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Could not cancel", errorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Actions" />
      <CardBody className="space-y-3">
        {isDraft && (
          <>
            <Button fullWidth onClick={() => void submit()} loading={submitting} disabled={missingCount > 0} leftIcon={<Send className="h-4 w-4" />}>
              Submit application
            </Button>
            {missingCount > 0 && <p className="text-caption text-muted">Upload the {missingCount} missing document{missingCount === 1 ? "" : "s"} to enable submission.</p>}
          </>
        )}
        {canCancel && (
          <Button fullWidth variant="outline" onClick={() => setCancelOpen(true)} leftIcon={<XCircle className="h-4 w-4 text-danger" />}>
            Cancel application
          </Button>
        )}
      </CardBody>
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancel}
        loading={cancelling}
        danger
        title="Cancel this application?"
        confirmLabel="Yes, cancel it"
        description={
          <div className="space-y-3">
            <p>This cannot be undone. You can start a new application later if you change your mind.</p>
            <Field label="Reason (optional)" htmlFor="cancelReason">
              <Textarea id="cancelReason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
        }
      />
    </Card>
  );
}
