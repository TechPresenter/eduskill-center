"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Power, PowerOff, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { FormFields, type FieldDef, type FormValues } from "@/components/admin/content/fields";

interface TrainerBasics {
  id: string;
  trainerId: string;
  status: "ACTIVE" | "INACTIVE";
  qualification: string | null;
  skills: string[];
  languages: string[];
  bio: string | null;
  user: { name: string; email: string | null; mobile: string | null };
}

const FIELDS: FieldDef[] = [
  { key: "name", label: "Full name", type: "text", required: true },
  { key: "email", label: "Email (login)", type: "email", required: true },
  { key: "mobile", label: "Mobile (login)", type: "text", required: true, placeholder: "10-digit mobile" },
  { key: "qualification", label: "Highest qualification", type: "text" },
  { key: "skills", label: "Skills", type: "tags", span: 2 },
  { key: "languages", label: "Languages", type: "tags", span: 2 },
  { key: "bio", label: "Short bio", type: "textarea", rows: 4 },
];

export function TrainerActions({ trainer, canUpdate }: { trainer: TrainerBasics; canUpdate: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState<"ACTIVE" | "INACTIVE" | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [values, setValues] = React.useState<FormValues>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!canUpdate) return null;

  const openEdit = () => {
    setValues({ name: trainer.user.name, email: trainer.user.email ?? "", mobile: trainer.user.mobile ?? "", qualification: trainer.qualification ?? "", skills: trainer.skills, languages: trainer.languages, bio: trainer.bio ?? "" });
    setErrors({});
    setFormError(null);
    setEditOpen(true);
  };

  const setStatus = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await api.post(`/api/admin/trainers/${trainer.id}/status`, { status: confirm });
      toast.success(confirm === "ACTIVE" ? "Trainer activated" : "Trainer deactivated");
      setConfirm(null);
      router.refresh();
    } catch (err) {
      toast.error("Could not update status", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await api.patch(`/api/admin/trainers/${trainer.id}`, values);
      toast.success("Trainer profile updated");
      setEditOpen(false);
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
      <Button size="sm" variant="outline" onClick={openEdit} leftIcon={<Pencil className="h-4 w-4" />}>
        Edit info
      </Button>
      {trainer.status === "ACTIVE" ? (
        <Button size="sm" variant="outline" className="text-danger hover:border-danger/40" onClick={() => setConfirm("INACTIVE")} leftIcon={<PowerOff className="h-4 w-4" />}>
          Deactivate
        </Button>
      ) : (
        <Button size="sm" variant="navy" onClick={() => setConfirm("ACTIVE")} leftIcon={<Power className="h-4 w-4" />}>
          Activate
        </Button>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => !busy && setConfirm(null)}
        onConfirm={setStatus}
        title={confirm === "INACTIVE" ? "Deactivate this trainer?" : "Activate this trainer?"}
        description={confirm === "INACTIVE" ? `${trainer.user.name} (${trainer.trainerId}) will be marked inactive. All active center and batch assignments end immediately and batches lose their trainer.` : `${trainer.user.name} (${trainer.trainerId}) will be able to receive assignments again.`}
        confirmLabel={confirm === "INACTIVE" ? "Deactivate" : "Activate"}
        danger={confirm === "INACTIVE"}
        loading={busy}
      />

      <Modal open={editOpen} onClose={() => !busy && setEditOpen(false)} title="Edit trainer information" description={`${trainer.trainerId} · changes to email/mobile also change the login.`} size="lg">
        <form onSubmit={save} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <FormFields fields={FIELDS} values={values} onChange={setValues} errors={errors} disabled={busy} idPrefix="tr" />
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function EndAssignmentButton({ assignmentId, label }: { assignmentId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const end = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/admin/trainers/assignments/${assignmentId}`);
      toast.success("Assignment ended");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Could not end assignment", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-light" onClick={() => setOpen(true)} leftIcon={<XCircle className="h-3.5 w-3.5" />}>
        End
      </Button>
      <ConfirmDialog open={open} onClose={() => !busy && setOpen(false)} onConfirm={end} title="End this assignment?" description={`The assignment at ${label} will be closed today. If a batch is linked, it will no longer have this trainer.`} confirmLabel="End assignment" danger loading={busy} />
    </>
  );
}
