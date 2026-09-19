"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";

export interface DocumentTypeRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  appliesTo: "STUDENT" | "TRAINER";
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  usedByCourses: number;
}

function DocTypeForm({ initial, onDone, onCancel }: { initial?: DocumentTypeRow; onDone: () => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [key, setKey] = React.useState(initial?.key ?? "");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [appliesTo, setAppliesTo] = React.useState(initial?.appliesTo ?? "STUDENT");
  const [isRequired, setIsRequired] = React.useState(initial?.isRequired ?? false);
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? true);
  const [sortOrder, setSortOrder] = React.useState(String(initial?.sortOrder ?? 0));
  const keyLocked = !!initial && initial.usedByCourses > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { key: key.trim().toLowerCase(), name, description: description || null, appliesTo, isRequired, isActive, sortOrder: Number(sortOrder) || 0 };
    const res = await submit(() => (initial ? api.put(`/api/admin/document-types/${initial.id}`, body) : api.post("/api/admin/document-types", body)), { silent: true });
    if (res !== undefined) {
      toast.success(initial ? "Document type updated" : "Document type added", name);
      onDone();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      <FormGrid>
        <Field label="Name" htmlFor="dt-name" required error={fieldErrors.name} className="sm:col-span-2">
          <Input id="dt-name" value={name} onChange={(e) => { setName(e.target.value); if (!initial && !key) setKey(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40)); clearField("name"); }} required maxLength={120} invalid={!!fieldErrors.name} autoFocus />
        </Field>
        <Field label="Key" htmlFor="dt-key" required error={fieldErrors.key} hint={keyLocked ? "Locked: courses reference this key." : "Lowercase letters, digits and underscores, e.g. id_proof. Stored on uploaded documents."}>
          <Input id="dt-key" value={key} onChange={(e) => { setKey(e.target.value.toLowerCase()); clearField("key"); }} required maxLength={41} className="font-mono" disabled={keyLocked} invalid={!!fieldErrors.key} />
        </Field>
        <Field label="Applies to" htmlFor="dt-applies" required error={fieldErrors.appliesTo}>
          <Select id="dt-applies" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as "STUDENT" | "TRAINER")} options={[{ value: "STUDENT", label: "Students" }, { value: "TRAINER", label: "Trainers" }]} />
        </Field>
        <Field label="Description" htmlFor="dt-desc" error={fieldErrors.description} className="sm:col-span-2" hint="Shown to applicants next to the upload box.">
          <Textarea id="dt-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
        </Field>
        <Field label="Sort order" htmlFor="dt-sort" error={fieldErrors.sortOrder}>
          <Input id="dt-sort" type="number" min={0} max={1000} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <div className="space-y-2 pt-1">
          <Checkbox checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} label="Required by default" description="Pre-selected when creating a course / requested from every trainer applicant." />
          <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Active" />
        </div>
      </FormGrid>
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initial ? "Save changes" : "Add document type"}
        </Button>
      </div>
    </form>
  );
}

export function DocumentTypesManager({ rows, canUpdate }: { rows: DocumentTypeRow[]; canUpdate: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<DocumentTypeRow | null>(null);
  const done = () => {
    setCreating(false);
    setEditing(null);
    router.refresh();
  };
  return (
    <div className="space-y-4">
      {canUpdate && (
        <div className="flex justify-end">
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Add document type
          </Button>
        </div>
      )}
      <TableWrap>
        <THead>
          <tr>
            <TH>Document</TH>
            <TH>Key</TH>
            <TH>Applies to</TH>
            <TH>Required</TH>
            <TH className="text-right">Courses</TH>
            <TH>Status</TH>
            <TH className="text-right">
              <span className="sr-only">Actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && <EmptyRow colSpan={7}>No document types configured.</EmptyRow>}
          {rows.map((d) => (
            <TR key={d.id}>
              <TD>
                <span className="block font-semibold">{d.name}</span>
                {d.description && <span className="block max-w-md text-xs text-muted">{d.description}</span>}
              </TD>
              <TD className="font-mono text-xs">{d.key}</TD>
              <TD>
                <Badge tone={d.appliesTo === "STUDENT" ? "navy" : "orange"}>{d.appliesTo === "STUDENT" ? "Students" : "Trainers"}</Badge>
              </TD>
              <TD>{d.isRequired ? <Badge tone="warning">Required</Badge> : <span className="text-xs text-muted">Optional</span>}</TD>
              <TD className="text-right tabular-nums">{d.appliesTo === "STUDENT" ? d.usedByCourses : "—"}</TD>
              <TD>
                <Badge tone={d.isActive ? "success" : "neutral"} dot>
                  {d.isActive ? "Active" : "Inactive"}
                </Badge>
              </TD>
              <TD className="text-right">
                {canUpdate && (
                  <span className="inline-flex gap-1">
                    <Button size="xs" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(d)}>
                      Edit
                    </Button>
                    <ConfirmAction size="xs" danger method="delete" url={`/api/admin/document-types/${d.id}`} title={`Delete ${d.name}?`} description="Fails if any course or uploaded document references this type – deactivate it instead in that case." confirmLabel="Delete" successMessage="Document type deleted" icon={<Trash2 className="h-3.5 w-3.5" />}>
                      Delete
                    </ConfirmAction>
                  </span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
      <Modal open={creating} onClose={() => setCreating(false)} title="Add a document type" size="lg">
        <DocTypeForm onCancel={() => setCreating(false)} onDone={done} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""} size="lg">
        {editing && <DocTypeForm initial={editing} onCancel={() => setEditing(null)} onDone={done} />}
      </Modal>
    </div>
  );
}
