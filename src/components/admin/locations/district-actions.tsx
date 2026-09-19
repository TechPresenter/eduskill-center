"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Checkbox } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { RecordActions } from "@/components/admin/shared/record-actions";

export interface DistrictRow {
  id: string;
  stateId: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
  centers: number;
  blocks: number;
  linked: number;
}

function DistrictForm({ initial, states, defaultStateId, onDone, onCancel }: { initial?: DistrictRow; states: SelectOption[]; defaultStateId?: string; onDone: () => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [stateId, setStateId] = React.useState(initial?.stateId ?? defaultStateId ?? "");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [code, setCode] = React.useState(initial?.code ?? "");
  const [sortOrder, setSortOrder] = React.useState(String(initial?.sortOrder ?? 0));
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? true);
  const codeLocked = !!initial && initial.centers > 0;
  const stateLocked = !!initial && initial.centers > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { stateId, name, code: code.trim().toUpperCase() || "", sortOrder: Number(sortOrder) || 0, isActive };
    const res = await submit(() => (initial ? api.put(`/api/admin/locations/districts/${initial.id}`, body) : api.post("/api/admin/locations/districts", body)), { silent: true });
    if (res !== undefined) {
      toast.success(initial ? "District updated" : "District added", name);
      onDone();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      <FormGrid>
        <Field label="State" htmlFor="dt-state" required error={fieldErrors.stateId} className="sm:col-span-2" hint={stateLocked ? "Districts with training centers cannot be moved to another state." : undefined}>
          <Select id="dt-state" value={stateId} onChange={(e) => { setStateId(e.target.value); clearField("stateId"); }} options={states} placeholder="Select state" required invalid={!!fieldErrors.stateId} disabled={stateLocked} />
        </Field>
        <Field label="District name" htmlFor="dt-name" required error={fieldErrors.name} className="sm:col-span-2">
          <Input id="dt-name" value={name} onChange={(e) => { setName(e.target.value); clearField("name"); }} invalid={!!fieldErrors.name} required maxLength={100} autoFocus />
        </Field>
        <Field label="District code" htmlFor="dt-code" error={fieldErrors.code} hint={codeLocked ? "Locked: this code is embedded in permanent center codes." : initial ? "3 letters/digits, unique within the state. Editable only while no center uses it." : "Optional – 3 letters/digits. Leave blank to derive it from the name."}>
          <Input id="dt-code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); clearField("code"); }} invalid={!!fieldErrors.code} maxLength={3} disabled={codeLocked} className="font-mono uppercase" placeholder={initial ? undefined : "AUTO"} />
        </Field>
        <Field label="Sort order" htmlFor="dt-sort" error={fieldErrors.sortOrder}>
          <Input id="dt-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} invalid={!!fieldErrors.sortOrder} />
        </Field>
      </FormGrid>
      <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Active" description="Inactive districts are hidden from public dropdowns." />
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initial ? "Save changes" : "Add district"}
        </Button>
      </div>
    </form>
  );
}

export function NewDistrictButton({ states, defaultStateId, disabled }: { states: SelectOption[]; defaultStateId?: string; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={disabled} className="hidden lg:inline-flex">
        Add district
      </Button>
      {!disabled && <Fab aria-label="Add district" icon={<Plus className="h-6 w-6" />} onClick={() => setOpen(true)} />}
      <Modal open={open} onClose={() => setOpen(false)} title="Add a district">
        <DistrictForm
          states={states}
          defaultStateId={defaultStateId}
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

export function DistrictRowActions({ district, states, canUpdate, canDelete }: { district: DistrictRow; states: SelectOption[]; canUpdate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const blocked = district.blocks > 0 || district.centers > 0 || district.linked > 0;
  return (
    <>
      <RecordActions className="max-md:[&_button]:h-11 max-md:[&_button]:w-11" label={`Actions for ${district.name}`} items={[{ label: "Edit", icon: <Pencil className="h-4 w-4" />, onClick: () => setEdit(true), hidden: !canUpdate }]}>
        {canUpdate && (
          <ConfirmAction
            asMenuItem
            icon={<Power className="h-4 w-4" />}
            method="put"
            url={`/api/admin/locations/districts/${district.id}`}
            body={{ isActive: !district.isActive }}
            title={district.isActive ? `Deactivate ${district.name}?` : `Activate ${district.name}?`}
            description={district.isActive ? "The district and its blocks will disappear from public dropdowns. Existing records are not changed." : "The district becomes selectable again."}
            confirmLabel={district.isActive ? "Deactivate" : "Activate"}
            successMessage={district.isActive ? "District deactivated" : "District activated"}
          >
            {district.isActive ? "Deactivate" : "Activate"}
          </ConfirmAction>
        )}
        {canDelete && (
          <ConfirmAction
            asMenuItem
            danger
            icon={<Trash2 className="h-4 w-4" />}
            method="delete"
            url={`/api/admin/locations/districts/${district.id}`}
            title={`Delete ${district.name}?`}
            description={blocked ? "This district still has blocks, centers or linked records and cannot be deleted. Deactivate it instead." : "This permanently removes the district."}
            confirmLabel="Delete"
            successMessage="District deleted"
            disabled={blocked}
          >
            Delete
          </ConfirmAction>
        )}
      </RecordActions>
      <Modal open={edit} onClose={() => setEdit(false)} title={`Edit ${district.name}`}>
        <DistrictForm
          initial={district}
          states={states}
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
