"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Power, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, RadioCards } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { RecordActions } from "@/components/admin/shared/record-actions";
import { PermissionMatrix } from "@/components/admin/shared/permission-matrix";
import { generatePassword, TemporaryPasswordModal, type RoleOption } from "@/components/admin/staff/staff-form";

export interface StaffProfile {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  mobile: string | null;
  designation: string | null;
  department: string | null;
  status: string;
  roleId: string | null;
  permissions: string[];
  rolePermissions: string[];
}

export interface StaffPerms {
  update: boolean;
  superAdmin: boolean;
  delete: boolean;
  isSelf: boolean;
}

function ProfileForm({ staff, onDone, onCancel }: { staff: StaffProfile; onDone: () => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [name, setName] = React.useState(staff.name);
  const [email, setEmail] = React.useState(staff.email);
  const [mobile, setMobile] = React.useState(staff.mobile ?? "");
  const [designation, setDesignation] = React.useState(staff.designation ?? "");
  const [department, setDepartment] = React.useState(staff.department ?? "");
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submit(() => api.put(`/api/admin/staff/${staff.id}`, { name, email, mobile: mobile || "", designation: designation || null, department: department || null }), { silent: true });
    if (res !== undefined) {
      toast.success("Profile updated");
      onDone();
    }
  };
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      <FormGrid>
        <Field label="Full name" htmlFor="sp-name" required error={fieldErrors.name} className="sm:col-span-2">
          <Input id="sp-name" value={name} onChange={(e) => { setName(e.target.value); clearField("name"); }} required invalid={!!fieldErrors.name} />
        </Field>
        <Field label="Email" htmlFor="sp-email" required error={fieldErrors.email}>
          <Input id="sp-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearField("email"); }} required invalid={!!fieldErrors.email} />
        </Field>
        <Field label="Mobile" htmlFor="sp-mobile" error={fieldErrors.mobile}>
          <Input id="sp-mobile" value={mobile} onChange={(e) => { setMobile(e.target.value); clearField("mobile"); }} inputMode="tel" invalid={!!fieldErrors.mobile} />
        </Field>
        <Field label="Designation" htmlFor="sp-desig" error={fieldErrors.designation}>
          <Input id="sp-desig" value={designation} onChange={(e) => setDesignation(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Department" htmlFor="sp-dept" error={fieldErrors.department}>
          <Input id="sp-dept" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={120} />
        </Field>
      </FormGrid>
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

function ResetPasswordForm({ staff, onDone, onCancel }: { staff: StaffProfile; onDone: (temp: string | null) => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [mode, setMode] = React.useState<"generate" | "set">("generate");
  const [password, setPassword] = React.useState("");
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submit(() => api.post<{ temporaryPassword: string | null }>(`/api/admin/staff/${staff.id}/reset-password`, { password: mode === "set" ? password : "" }), { silent: true });
    if (res) {
      toast.success("Password reset", "All sessions of this staff member were logged out.");
      onDone(res.temporaryPassword);
    }
  };
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      <RadioCards
        name="resetMode"
        value={mode}
        onChange={(v) => setMode(v as "generate" | "set")}
        columns={1}
        options={[
          { value: "generate", label: "Generate a temporary password", description: "Shown once after resetting." },
          { value: "set", label: "Set a specific password", description: "At least 8 characters with a letter and a number." },
        ]}
      />
      {mode === "set" && (
        <Field label="New password" htmlFor="rp-pass" required error={fieldErrors.password}>
          <div className="flex gap-2">
            <Input id="rp-pass" type="text" value={password} onChange={(e) => { setPassword(e.target.value); clearField("password"); }} required minLength={8} className="font-mono" invalid={!!fieldErrors.password} autoComplete="new-password" />
            <Button type="button" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => setPassword(generatePassword())}>
              Generate
            </Button>
          </div>
        </Field>
      )}
      <Alert tone="warning">The staff member is logged out of every device immediately.</Alert>
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading} variant="danger">
          Reset password
        </Button>
      </div>
    </form>
  );
}

export function StaffHeaderActions({ staff, perms }: { staff: StaffProfile; perms: StaffPerms }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const [reset, setReset] = React.useState(false);
  const [temp, setTemp] = React.useState<string | null>(null);
  const active = staff.status === "ACTIVE";
  return (
    <>
      {perms.update && (
        <Button size="sm" variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(true)}>
          Edit profile
        </Button>
      )}
      {perms.superAdmin && (
        <Button size="sm" variant="outline" leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => setReset(true)}>
          Reset password
        </Button>
      )}
      {perms.superAdmin && !perms.isSelf && (
        <RecordActions label="More actions">
          <ConfirmAction asMenuItem icon={<Power className="h-4 w-4" />} method="patch" url={`/api/admin/staff/${staff.id}/status`} body={{ status: active ? "INACTIVE" : "ACTIVE" }} title={active ? `Deactivate ${staff.name}?` : `Activate ${staff.name}?`} description={active ? "They are logged out everywhere and cannot sign in until reactivated." : "They can sign in again."} confirmLabel={active ? "Deactivate" : "Activate"} successMessage={active ? "Account deactivated" : "Account activated"}>
            {active ? "Deactivate account" : "Activate account"}
          </ConfirmAction>
          {staff.status !== "SUSPENDED" && (
            <ConfirmAction asMenuItem danger icon={<ShieldAlert className="h-4 w-4" />} method="patch" url={`/api/admin/staff/${staff.id}/status`} body={{ status: "SUSPENDED" }} title={`Suspend ${staff.name}?`} description="Suspension blocks login and ends every session. Use for security incidents." confirmLabel="Suspend" successMessage="Account suspended">
              Suspend account
            </ConfirmAction>
          )}
          {perms.delete && (
            <ConfirmAction asMenuItem danger icon={<Trash2 className="h-4 w-4" />} method="delete" url={`/api/admin/staff/${staff.id}`} title={`Delete ${staff.name}'s account?`} description="The staff record is archived, the login is disabled and all sessions are revoked. Audit history is kept." confirmLabel="Delete account" successMessage="Staff account deleted" redirectTo="/admin/staff">
              Delete account
            </ConfirmAction>
          )}
        </RecordActions>
      )}
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit profile" size="lg">
        <ProfileForm
          staff={staff}
          onCancel={() => setEdit(false)}
          onDone={() => {
            setEdit(false);
            router.refresh();
          }}
        />
      </Modal>
      <Modal open={reset} onClose={() => setReset(false)} title={`Reset password for ${staff.name}`}>
        <ResetPasswordForm
          staff={staff}
          onCancel={() => setReset(false)}
          onDone={(t) => {
            setReset(false);
            setTemp(t);
            router.refresh();
          }}
        />
      </Modal>
      {temp && <TemporaryPasswordModal open onClose={() => setTemp(null)} password={temp} email={staff.email} title="New temporary password" />}
    </>
  );
}

export function StaffRoleCard({ staff, roles, editable }: { staff: StaffProfile; roles: RoleOption[]; editable: boolean }) {
  const router = useRouter();
  const [roleId, setRoleId] = React.useState(staff.roleId ?? "");
  const { loading, error, submit } = useApiForm();
  const role = roles.find((r) => r.id === roleId);
  const save = async () => {
    const res = await submit(() => api.patch(`/api/admin/staff/${staff.id}/role`, { roleId: roleId || "" }), { silent: true });
    if (res !== undefined) {
      toast.success("Role updated", role ? role.name : "No role");
      router.refresh();
    }
  };
  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Role" htmlFor="sr-role" hint={role?.description ?? "No role – only direct permissions apply."}>
        <Select id="sr-role" value={roleId} onChange={(e) => setRoleId(e.target.value)} options={roles.map((r) => ({ value: r.id, label: `${r.name} · ${r.permissions.length} permissions` }))} placeholder="No role" disabled={!editable || loading} />
      </Field>
      {editable && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} loading={loading} disabled={roleId === (staff.roleId ?? "")}>
            Save role
          </Button>
        </div>
      )}
    </div>
  );
}

export function StaffPermissionsCard({ staff, editable }: { staff: StaffProfile; editable: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState<string[]>(staff.permissions);
  const { loading, error, submit } = useApiForm();
  const dirty = value.length !== staff.permissions.length || value.some((k) => !staff.permissions.includes(k));
  const save = async () => {
    const res = await submit(() => api.put(`/api/admin/staff/${staff.id}/permissions`, { permissions: value }), { silent: true });
    if (res !== undefined) {
      toast.success("Direct permissions saved", `${value.length} granted directly.`);
      router.refresh();
    }
  };
  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <PermissionMatrix value={value} onChange={setValue} inherited={staff.rolePermissions} disabled={!editable || loading} />
      {editable && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setValue(staff.permissions)} disabled={!dirty || loading}>
            Reset
          </Button>
          <Button size="sm" onClick={save} loading={loading} disabled={!dirty}>
            Save permissions
          </Button>
        </div>
      )}
    </div>
  );
}
