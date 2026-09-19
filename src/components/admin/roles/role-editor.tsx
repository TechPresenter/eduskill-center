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

/** "Create role" button + modal; navigates to the new role on success. */
export function CreateRoleButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
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
      <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={disabled}>
        Create role
      </Button>
      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Create a role" description="Roles bundle permissions. Assign them to staff from the staff profile." size="xl">
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
          <RoleFields name={name} setName={setName} description={description} setDescription={setDescription} permissions={permissions} setPermissions={setPermissions} fieldErrors={fieldErrors} clearField={clearField} />
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create role
            </Button>
          </div>
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
          <div className="hidden gap-2 lg:flex">
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
        <StickyActionBar desktop="hidden">
          <Button type="button" variant="outline" onClick={reset} disabled={!dirty || loading} className="flex-1">
            Discard
          </Button>
          <Button type="submit" loading={loading} disabled={!dirty} leftIcon={<Save className="h-4 w-4" />} className="flex-2">
            Save role
          </Button>
        </StickyActionBar>
      )}
    </form>
  );
}
