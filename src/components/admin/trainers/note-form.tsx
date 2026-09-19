"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";

export function NoteForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/admin/trainer-applications/${applicationId}/notes`, { note });
      setNote("");
      toast.success("Note added");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? (err.fieldErrors.note ?? err.message) : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Field label="Add an internal note" htmlFor="app-note" error={error} hint="Notes are visible to Foundation staff only.">
        <Textarea id="app-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} invalid={!!error} placeholder="e.g. Called the applicant to confirm availability." />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="navy" loading={busy} disabled={note.trim().length < 2} leftIcon={<MessageSquarePlus className="h-4 w-4" />}>
          Add note
        </Button>
      </div>
    </form>
  );
}
