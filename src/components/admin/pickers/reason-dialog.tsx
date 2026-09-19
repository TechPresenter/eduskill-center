"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Minimum characters required (0 makes the reason optional). */
  minLength?: number;
  /** Field-level error from the server (422), shown under the textarea. */
  error?: string;
  loading?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
  children?: React.ReactNode;
}

function ReasonForm({ onClose, label, placeholder, confirmLabel, danger, minLength, error, loading, onConfirm, children }: Omit<ReasonDialogProps, "open" | "title" | "description">) {
  const [reason, setReason] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const id = React.useId();
  const min = minLength ?? 3;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (min > 0 && trimmed.length < min) {
      setLocalError(`Please enter at least ${min} characters`);
      return;
    }
    setLocalError(null);
    await onConfirm(trimmed);
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {children}
      <Field label={label ?? "Reason"} htmlFor={id} required={min > 0} error={localError ?? error}>
        <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} rows={4} invalid={!!(localError ?? error)} autoFocus />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" variant={danger ? "danger" : "primary"} loading={loading}>
          {confirmLabel ?? "Confirm"}
        </Button>
      </div>
    </form>
  );
}

/** Modal asking for a note / reason before an action (reject, cancel, revoke, refund, request documents…). The form remounts on every open. */
export function ReasonDialog({ open, onClose, title, description, ...rest }: ReasonDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      <ReasonForm onClose={onClose} {...rest} />
    </Modal>
  );
}
