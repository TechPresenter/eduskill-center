"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, RefreshCw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormGrid, FormSection } from "@/components/ui/form";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Input, RadioCards } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { PermissionMatrix } from "@/components/admin/shared/permission-matrix";
import { CopyButton } from "@/components/admin/shared/copy-button";

export interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

/** Browser-side generator with the same character classes as the server default (12 chars, letter + digit + symbol). */
export function generatePassword(length = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$%&*!";
  const all = upper + lower + digits + symbols;
  const rnd = (n: number) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0]! % n;
  };
  const pick = (s: string) => s[rnd(s.length)]!;
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

export function TemporaryPasswordModal({ open, onClose, password, email, title = "Temporary password" }: { open: boolean; onClose: () => void; password: string; email: string; title?: string }) {
  return (
    <Modal open={open} onClose={onClose} title={title} description="Share this with the staff member securely. It is shown only once and cannot be retrieved later." size="sm">
      <div className="space-y-4">
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-overline text-muted">Login</p>
          <p className="text-sm font-medium text-ink">{email}</p>
          <p className="mt-3 text-overline text-muted">Password</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <code className="font-mono text-lg font-bold text-navy break-all">{password}</code>
            <CopyButton text={password} />
          </div>
        </div>
        <Alert tone="warning">Ask them to change it from their Account page after the first login.</Alert>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>
            I have saved it
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function StaffCreateForm({ roles }: { roles: RoleOption[] }) {
  const router = useRouter();
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [designation, setDesignation] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [roleId, setRoleId] = React.useState("");
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [pwMode, setPwMode] = React.useState<"generate" | "set">("generate");
  const [password, setPassword] = React.useState("");
  const [created, setCreated] = React.useState<{ id: string; email: string; temporaryPassword: string | null } | null>(null);
  const role = roles.find((r) => r.id === roleId);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name, email, mobile: mobile || "", designation: designation || null, department: department || null, roleId: roleId || "", permissions, password: pwMode === "set" ? password : "" };
    const res = await submit(() => api.post<{ staff: { id: string; employeeCode: string; user: { email: string | null } }; temporaryPassword: string | null }>("/api/admin/staff", body), { silent: true });
    if (!res) return;
    toast.success("Staff account created", `${res.staff.employeeCode} · ${name}`);
    setCreated({ id: res.staff.id, email: res.staff.user.email ?? email, temporaryPassword: res.temporaryPassword });
    router.refresh();
  };

  if (created) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Account created">
          {name} can now log in at /login with their email{created.temporaryPassword ? " and the temporary password below" : " and the password you set"}.
        </Alert>
        {created.temporaryPassword && <TemporaryPasswordModal open onClose={() => router.push(`/admin/staff/${created.id}`)} password={created.temporaryPassword} email={created.email} />}
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/admin/staff/${created.id}`}>Open profile</ButtonLink>
          <ButtonLink href="/admin/staff" variant="outline">
            Back to staff list
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      {error && Object.keys(fieldErrors).length > 0 && <Alert tone="warning">{error}</Alert>}

      <FormSection title="Profile">
        <FormGrid>
          <Field label="Full name" htmlFor="sf-name" required error={fieldErrors.name}>
            <Input id="sf-name" value={name} onChange={(e) => { setName(e.target.value); clearField("name"); }} required maxLength={120} invalid={!!fieldErrors.name} autoFocus />
          </Field>
          <Field label="Email (login)" htmlFor="sf-email" required error={fieldErrors.email}>
            <Input id="sf-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearField("email"); }} required invalid={!!fieldErrors.email} autoComplete="off" />
          </Field>
          <Field label="Mobile" htmlFor="sf-mobile" error={fieldErrors.mobile} hint="Optional · 10-digit Indian number, can also be used to log in.">
            <Input id="sf-mobile" value={mobile} onChange={(e) => { setMobile(e.target.value); clearField("mobile"); }} inputMode="tel" invalid={!!fieldErrors.mobile} />
          </Field>
          <Field label="Designation" htmlFor="sf-desig" error={fieldErrors.designation}>
            <Input id="sf-desig" value={designation} onChange={(e) => setDesignation(e.target.value)} maxLength={120} placeholder="e.g. Admissions Officer" />
          </Field>
          <Field label="Department" htmlFor="sf-dept" error={fieldErrors.department}>
            <Input id="sf-dept" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={120} placeholder="e.g. Admissions" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Role & permissions" description="The role provides a base set of permissions. Extra permissions can be granted directly to this person.">
        <Field label="Role" htmlFor="sf-role" error={fieldErrors.roleId} hint={role?.description ?? "Choose a role, or leave empty and grant permissions directly."}>
          <Select id="sf-role" value={roleId} onChange={(e) => { setRoleId(e.target.value); clearField("roleId"); }} options={roles.map((r) => ({ value: r.id, label: `${r.name} · ${r.permissions.length} permission${r.permissions.length === 1 ? "" : "s"}` }))} placeholder="No role" invalid={!!fieldErrors.roleId} />
        </Field>
        <Field label="Extra permissions" error={fieldErrors.permissions}>
          <PermissionMatrix value={permissions} onChange={(v) => { setPermissions(v); clearField("permissions"); }} inherited={role?.permissions ?? []} />
        </Field>
      </FormSection>

      <FormSection title="Password">
        <RadioCards
          name="pwMode"
          value={pwMode}
          onChange={(v) => setPwMode(v as "generate" | "set")}
          columns={2}
          options={[
            { value: "generate", label: "Generate a temporary password", description: "A strong 12-character password is created and shown once after saving." },
            { value: "set", label: "Set a password now", description: "At least 8 characters with a letter and a number." },
          ]}
        />
        {pwMode === "set" && (
          <Field label="Password" htmlFor="sf-pass" required error={fieldErrors.password}>
            <div className="flex gap-2">
              <Input id="sf-pass" type="text" value={password} onChange={(e) => { setPassword(e.target.value); clearField("password"); }} required minLength={8} maxLength={200} invalid={!!fieldErrors.password} className="font-mono" autoComplete="new-password" />
              <Button type="button" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => setPassword(generatePassword())}>
                Generate
              </Button>
            </div>
          </Field>
        )}
      </FormSection>

      {/* Phones: the form is long (the permission matrix), so the primary action stays under the thumb. */}
      <StickyActionBar innerClassName="lg:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/staff")} disabled={loading} className="flex-1 lg:flex-none">
          Cancel
        </Button>
        <Button type="submit" loading={loading} leftIcon={<KeyRound className="h-4 w-4" />} className="flex-2 lg:flex-none">
          Create account
        </Button>
      </StickyActionBar>
    </form>
  );
}
