"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { PermissionMatrix } from "@/components/admin/shared/permission-matrix";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Fab } from "@/components/ui/fab";
import { SaveStatus } from "@/components/admin/content/app-list";
import { useUnsavedChangesWarning } from "@/components/admin/content/use-unsaved";

export interface RoleData {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  staffCount: number;
}

interface RoleResponse {
  id: string;
  name: string;
}

function RoleFields({ name, setName, description, setDescription, permissions, setPermissions, fieldErrors, clearField, disabled }: { name: string; setName: (v: string) => void; description: string; setDescription: (v: string) => void; permissions: string[]; setPermissions: (v: string[]) => void; fieldErrors: Record<string, string>; clearField: (k: string) => void; disabled?: boolean }) {
  return (
    <>
      <FormGrid>
        <Field label="Role name" htmlFor="rl-name" required error={fieldErrors.name}>
          <Input id="rl-name" value={name} onChange={(e) => { setName(e.target.value); clearField("name"); }} required maxLength={80} invalid={!!fieldErrors.name} disabled={disabled} />
        </Field>
        <Field label="Description" htmlFor="rl-desc" error={fieldErrors.description}>
          <Textarea id="rl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} disabled={disabled} />
        </Field>
      </FormGrid>
      <Field label="Permissions" error={fieldErrors.permissions}>
        <PermissionMatrix value={permissions} onChange={(v) => { setPermissions(v); clearField("permissions"); }} disabled={disabled} />
      </Field>
    </>
  );
}

/**
 * "Create role" button + editor; navigates to the new role on success. `fab` renders the phone
 * floating action button instead of the header button (both open the same sheet).
 */
export function CreateRoleButton({ disabled, variant = "button" }: { disabled?: boolean; variant?: "button" | "fab" }) {
  const router = useRouter();
  const formId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [permissions, setPermissions] = React.useState<string[]>(["dashboard.view"]);
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submit(() => api.post<RoleResponse>("/api/admin/roles", { name, description: description || null, permissions }), { silent: true });
    if (res) {
      toast.success("Role created", res.name);
      setOpen(false);
      router.push(`/admin/roles/${res.id}`);
      router.refresh();
    }
  };
  return (
    <>
      {variant === "fab" ? (
        disabled ? null : <Fab aria-label="Create role" icon={<Plus className="h-6 w-6" aria-hidden />} onClick={() => setOpen(true)} />
      ) : (
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={disabled}>
          Create role
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title="Create a role"
        description="Roles bundle permissions. Assign them to staff from the staff profile."
        size="xl"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={loading} leftIcon={<Save className="h-4 w-4" />}>
              Create role · {permissions.length}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={onSubmit} className="space-y-5" noValidate>
          {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
          <RoleFields name={name} setName={setName} description={description} setDescription={setDescription} permissions={permissions} setPermissions={setPermissions} fieldErrors={fieldErrors} clearField={clearField} />
        </form>
      </Modal>
    </>
  );
}

/** Full editor for an existing role. */
export function RoleEditor({ role, editable, deletable }: { role: RoleData; editable: boolean; deletable: boolean }) {
  const router = useRouter();
  const [name, setName] = React.useState(role.name);
  const [description, setDescription] = React.useState(role.description ?? "");
  const [permissions, setPermissions] = React.useState<string[]>(role.permissions);
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const reset = () => {
    setName(role.name);
    setDescription(role.description ?? "");
    setPermissions(role.permissions);
  };
  const dirty = name !== role.name || description !== (role.description ?? "") || permissions.length !== role.permissions.length || permissions.some((p) => !role.permissions.includes(p));
  useUnsavedChangesWarning(dirty && editable);
  const state = loading ? "saving" : error ? "error" : dirty ? "dirty" : "clean";
  const idle = `${role.permissions.length} permission${role.permissions.length === 1 ? "" : "s"} saved`;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submit(() => api.put<RoleResponse>(`/api/admin/roles/${role.id}`, { name, description: description || null, permissions }), { silent: true });
    if (res) {
      toast.success("Role saved", `${permissions.length} permission${permissions.length === 1 ? "" : "s"}. Staff with this role get the change on their next request.`);
      router.refresh();
    }
  };

  const deleteBlocked = role.isSystem || role.staffCount > 0;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      {!editable && <Alert tone="info">Only the Super Admin can change roles. You are viewing this role read-only.</Alert>}
      <RoleFields name={name} setName={setName} description={description} setDescription={setDescription} permissions={permissions} setPermissions={setPermissions} fieldErrors={fieldErrors} clearField={clearField} disabled={!editable || loading} />
      {editable && (
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="[&_button]:w-full lg:[&_button]:w-auto">
            {deletable && (
              <ConfirmAction method="delete" url={`/api/admin/roles/${role.id}`} danger title={`Delete the role “${role.name}”?`} description={role.isSystem ? "System roles cannot be deleted. Edit their permissions instead." : role.staffCount > 0 ? `${role.staffCount} staff member(s) still use this role. Assign them another role first.` : "This permanently removes the role."} confirmLabel="Delete role" successMessage="Role deleted" redirectTo="/admin/roles" disabled={deleteBlocked} icon={<Trash2 className="h-4 w-4" />}>
                Delete role
              </ConfirmAction>
            )}
          </div>
          {/* Desktop action row; phones use the sticky bar below so Save is always reachable. */}
          <div className="hidden items-center gap-3 lg:flex">
            <SaveStatus state={state} idle={idle} />
            <Button type="button" variant="outline" onClick={reset} disabled={!dirty || loading}>
              Discard
            </Button>
            <Button type="submit" loading={loading} disabled={!dirty} leftIcon={<Save className="h-4 w-4" />}>
              Save role
            </Button>
          </div>
        </div>
      )}
      {editable && (
        <StickyActionBar desktop="hidden" innerClassName="flex-col">
          <SaveStatus state={state} idle={idle} className="justify-center" />
          <div className="flex w-full gap-2">
            <Button type="button" variant="outline" onClick={reset} disabled={!dirty || loading} className="flex-1">
              Discard
            </Button>
            <Button type="submit" loading={loading} disabled={!dirty} leftIcon={<Save className="h-4 w-4" />} className="flex-2">
              Save role
            </Button>
          </div>
        </StickyActionBar>
      )}
    </form>
  );
}
