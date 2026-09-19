"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Checkbox } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { RecordActions } from "@/components/admin/shared/record-actions";

export interface StateRow {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
  centers: number;
  districts: number;
  linked: number;
}

function StateForm({ initial, onDone, onCancel }: { initial?: StateRow; onDone: () => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [code, setCode] = React.useState(initial?.code ?? "");
  const [sortOrder, setSortOrder] = React.useState(String(initial?.sortOrder ?? 0));
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? true);
  const codeLocked = !!initial && initial.centers > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name, code: code.toUpperCase(), sortOrder: Number(sortOrder) || 0, isActive };
    const res = await submit(() => (initial ? api.put(`/api/admin/locations/states/${initial.id}`, body) : api.post("/api/admin/locations/states", body)), { silent: true });
    if (res !== undefined) {
      toast.success(initial ? "State updated" : "State added", `${name} (${code.toUpperCase()})`);
      onDone();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      <FormGrid>
        <Field label="State name" htmlFor="st-name" required error={fieldErrors.name} className="sm:col-span-2">
          <Input id="st-name" value={name} onChange={(e) => { setName(e.target.value); clearField("name"); }} invalid={!!fieldErrors.name} required maxLength={100} autoFocus />
        </Field>
        <Field label="State code" htmlFor="st-code" required error={fieldErrors.code} hint={codeLocked ? "Locked: this code is part of existing center codes." : "2–3 letters, e.g. WB. Used in every center code of this state."}>
          <Input id="st-code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); clearField("code"); }} invalid={!!fieldErrors.code} required maxLength={3} disabled={codeLocked} className="font-mono uppercase" />
        </Field>
        <Field label="Sort order" htmlFor="st-sort" error={fieldErrors.sortOrder} hint="Lower numbers appear first in dropdowns.">
          <Input id="st-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} invalid={!!fieldErrors.sortOrder} />
        </Field>
      </FormGrid>
      <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Active" description="Inactive states are hidden from public dropdowns and new registrations." />
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initial ? "Save changes" : "Add state"}
        </Button>
      </div>
    </form>
  );
}

export function NewStateButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={disabled} className="hidden lg:inline-flex">
        Add state
      </Button>
      {!disabled && <Fab aria-label="Add state" icon={<Plus className="h-6 w-6" />} onClick={() => setOpen(true)} />}
      <Modal open={open} onClose={() => setOpen(false)} title="Add a state / union territory">
        <StateForm
          onCancel={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}

export function StateRowActions({ state, canUpdate, canDelete }: { state: StateRow; canUpdate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const blocked = state.districts > 0 || state.linked > 0;
  return (
    <>
      <RecordActions className="max-md:[&_button]:h-11 max-md:[&_button]:w-11" label={`Actions for ${state.name}`} items={[{ label: "Edit", icon: <Pencil className="h-4 w-4" />, onClick: () => setEdit(true), hidden: !canUpdate }]}>
        {canUpdate && (
          <ConfirmAction
            asMenuItem
            icon={<Power className="h-4 w-4" />}
            method="put"
            url={`/api/admin/locations/states/${state.id}`}
            body={{ isActive: !state.isActive }}
            title={state.isActive ? `Deactivate ${state.name}?` : `Activate ${state.name}?`}
            description={state.isActive ? "The state and its districts/blocks will disappear from public dropdowns. Existing centers and records are not changed." : "The state becomes selectable again in registration forms and center search."}
            confirmLabel={state.isActive ? "Deactivate" : "Activate"}
            successMessage={state.isActive ? "State deactivated" : "State activated"}
          >
            {state.isActive ? "Deactivate" : "Activate"}
          </ConfirmAction>
        )}
        {canDelete && (
          <ConfirmAction
            asMenuItem
            danger
            icon={<Trash2 className="h-4 w-4" />}
            method="delete"
            url={`/api/admin/locations/states/${state.id}`}
            title={`Delete ${state.name}?`}
            description={blocked ? "This state still has districts or linked records and cannot be deleted. Deactivate it instead." : "This permanently removes the state. This cannot be undone."}
            confirmLabel="Delete"
            successMessage="State deleted"
            disabled={blocked}
          >
            Delete
          </ConfirmAction>
        )}
      </RecordActions>
      <Modal open={edit} onClose={() => setEdit(false)} title={`Edit ${state.name}`}>
        <StateForm
          initial={state}
          onCancel={() => setEdit(false)}
          onDone={() => {
            setEdit(false);
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
