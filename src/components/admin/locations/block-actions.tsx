"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Checkbox, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { LocationCascade, type LocationValue } from "@/components/shared/location-cascade";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { RecordActions } from "@/components/admin/shared/record-actions";

export interface BlockRow {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  sortOrder: number;
  districtName: string;
  stateName: string;
  centers: number;
  linked: number;
}

function splitNames(text: string) {
  return Array.from(new Set(text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)));
}

/** Bulk add: pick a district, paste one block name per line. */
export function BulkAddBlocksButton({ disabled, initial }: { disabled?: boolean; initial?: LocationValue }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loc, setLoc] = React.useState<LocationValue>({ stateId: initial?.stateId, districtId: initial?.districtId });
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<{ created: { id: string; name: string }[]; skipped: string[] } | null>(null);
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const names = splitNames(text);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submit(() => api.post<{ created: { id: string; name: string }[]; skipped: string[] }>("/api/admin/locations/blocks", { districtId: loc.districtId, names }), { silent: true });
    if (res) {
      setResult(res);
      setText("");
      toast.success(`${res.created.length} block${res.created.length === 1 ? "" : "s"} added`, res.skipped.length ? `${res.skipped.length} already existed and were skipped.` : undefined);
      router.refresh();
    }
  };

  return (
    <>
      <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={disabled} className="hidden lg:inline-flex">
        Add blocks
      </Button>
      {!disabled && <Fab aria-label="Add blocks" icon={<Plus className="h-6 w-6" />} onClick={() => setOpen(true)} />}
      <Modal
        open={open}
        onClose={() => {
          if (loading) return;
          setOpen(false);
          setResult(null);
        }}
        title="Add blocks to a district"
        description="Paste one block name per line (or separate with commas). Duplicates inside the district are skipped."
        size="lg"
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
          <LocationCascade depth="district" value={loc} onChange={(v) => { setLoc(v); clearField("districtId"); }} required errors={{ districtId: fieldErrors.districtId }} className="grid grid-cols-1 gap-4 sm:grid-cols-2" />
          <Field label="Block names" htmlFor="bl-names" required error={fieldErrors.names} hint={`${names.length} name${names.length === 1 ? "" : "s"} detected · 2–100 characters each · up to 300 per import`}>
            <Textarea id="bl-names" rows={8} value={text} onChange={(e) => { setText(e.target.value); clearField("names"); }} placeholder={"Bidhannagar\nRajarhat\nBarasat"} invalid={!!fieldErrors.names} />
          </Field>
          {result && (
            <Alert tone="success" title={`${result.created.length} created`}>
              {result.created.length > 0 && <p>{result.created.map((c) => c.name).join(", ")}</p>}
              {result.skipped.length > 0 && <p className="mt-1">Skipped (already exist): {result.skipped.join(", ")}</p>}
            </Alert>
          )}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setResult(null); }} disabled={loading}>
              Close
            </Button>
            <Button type="submit" loading={loading} disabled={!loc.districtId || names.length === 0}>
              Add {names.length || ""} block{names.length === 1 ? "" : "s"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function BlockForm({ initial, onDone, onCancel }: { initial: BlockRow; onDone: () => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [name, setName] = React.useState(initial.name);
  const [code, setCode] = React.useState(initial.code ?? "");
  const [sortOrder, setSortOrder] = React.useState(String(initial.sortOrder));
  const [isActive, setIsActive] = React.useState(initial.isActive);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submit(() => api.put(`/api/admin/locations/blocks/${initial.id}`, { name, code: code.trim().toUpperCase(), sortOrder: Number(sortOrder) || 0, isActive }), { silent: true });
    if (res !== undefined) {
      toast.success("Block updated", name);
      onDone();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      <p className="text-sm text-muted">
        {initial.districtName}, {initial.stateName}
      </p>
      <FormGrid>
        <Field label="Block name" htmlFor="bk-name" required error={fieldErrors.name} className="sm:col-span-2">
          <Input id="bk-name" value={name} onChange={(e) => { setName(e.target.value); clearField("name"); }} invalid={!!fieldErrors.name} required maxLength={100} autoFocus />
        </Field>
        <Field label="Block code" htmlFor="bk-code" error={fieldErrors.code} hint="Optional short code (up to 10 characters) for your own reference.">
          <Input id="bk-code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); clearField("code"); }} invalid={!!fieldErrors.code} maxLength={10} className="font-mono uppercase" />
        </Field>
        <Field label="Sort order" htmlFor="bk-sort" error={fieldErrors.sortOrder}>
          <Input id="bk-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} invalid={!!fieldErrors.sortOrder} />
        </Field>
      </FormGrid>
      <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Active" description="Inactive blocks are hidden from public dropdowns." />
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

export function BlockRowActions({ block, canUpdate, canDelete }: { block: BlockRow; canUpdate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const blocked = block.centers > 0 || block.linked > 0;
  return (
    <>
      <RecordActions className="max-md:[&_button]:h-11 max-md:[&_button]:w-11" label={`Actions for ${block.name}`} items={[{ label: "Edit", icon: <Pencil className="h-4 w-4" />, onClick: () => setEdit(true), hidden: !canUpdate }]}>
        {canUpdate && (
          <ConfirmAction
            asMenuItem
            icon={<Power className="h-4 w-4" />}
            method="put"
            url={`/api/admin/locations/blocks/${block.id}`}
            body={{ isActive: !block.isActive }}
            title={block.isActive ? `Deactivate ${block.name}?` : `Activate ${block.name}?`}
            description={block.isActive ? "The block disappears from public dropdowns. Existing centers and records are not changed." : "The block becomes selectable again."}
            confirmLabel={block.isActive ? "Deactivate" : "Activate"}
            successMessage={block.isActive ? "Block deactivated" : "Block activated"}
          >
            {block.isActive ? "Deactivate" : "Activate"}
          </ConfirmAction>
        )}
        {canDelete && (
          <ConfirmAction
            asMenuItem
            danger
            icon={<Trash2 className="h-4 w-4" />}
            method="delete"
            url={`/api/admin/locations/blocks/${block.id}`}
            title={`Delete ${block.name}?`}
            description={blocked ? "This block has training centers or linked records and cannot be deleted. Deactivate it instead." : "This permanently removes the block."}
            confirmLabel="Delete"
            successMessage="Block deleted"
            disabled={blocked}
          >
            Delete
          </ConfirmAction>
        )}
      </RecordActions>
      <Modal open={edit} onClose={() => setEdit(false)} title={`Edit ${block.name}`}>
        <BlockForm
          initial={block}
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
