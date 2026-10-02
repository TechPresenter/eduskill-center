import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/utils";
import { deviceLabel } from "@/lib/auth/device";
import { adminPasswordLoginEnabled, adminTwoFactorRequired } from "@/lib/auth/policy";
import { accountProfile, accountSessions } from "@/app/admin/account/queries";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { DataList } from "@/components/ui/table";
import { AccountHeading, AccountTabs } from "@/components/admin/account-security/account-tabs";
import { signInMethodLabel } from "@/components/admin/account-security/labels";

export const metadata: Metadata = { title: "My Account · Foundation Admin" };

export default async function AccountPage() {
  const me = await requireAdmin();
  const required = await adminTwoFactorRequired();
  const [user, sessions] = await Promise.all([accountProfile(me.id), accountSessions(me.id, me.sessionId, { needsMfa: me.security.twoFactorEnabled || required })]);
  const current = sessions.find((s) => s.current);
  const isSuper = user.role === "SUPER_ADMIN";
  const roleLabel = isSuper ? "Super Admin" : (user.staff?.role?.name ?? "Foundation Staff");
  const twoFactorOn = me.security.twoFactorEnabled;

  return (
    <div>
      <PageHeader title={<AccountHeading name={user.name} avatarUrl={user.avatarUrl} roleLabel={roleLabel} />} mobileTitle="My account" description="Your profile and how you sign in." />
      <AccountTabs />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Profile" description={isSuper ? "You can change your login email on the Security tab." : "Contact the Super Admin to change your name or email."} />
          <CardBody>
            {/* One description list, not nine: the profile is a single set of term/value pairs. */}
            <DataList
              items={[
                { label: "Email", value: user.email ?? "—" },
                { label: "Mobile", value: user.mobile ?? "—" },
                { label: "Role", value: isSuper ? "Super Admin (all permissions)" : (user.staff?.role?.name ?? "Staff without role") },
                ...(user.staff ? [{ label: "Employee code", value: <span className="font-mono">{user.staff.employeeCode}</span> }] : []),
                ...(user.staff?.designation ? [{ label: "Designation", value: user.staff.designation }] : []),
                ...(user.staff?.department ? [{ label: "Department", value: user.staff.department }] : []),
                { label: "Account status", value: <StatusBadge status={user.status} /> },
                { label: "Last login", value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—" },
                { label: "Member since", value: formatDateTime(user.createdAt) },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sign-in & security" description="A summary of how your account is protected." />
          <CardBody className="space-y-4">
            {!twoFactorOn && <Alert tone="warning">Turn on two-factor authentication so that your sign-in code alone is not enough to reach the admin panel.</Alert>}
            <DataList
              variant="rows"
              items={[
                {
                  label: "Two-factor",
                  value: twoFactorOn ? (
                    <Badge tone="success" dot>
                      On
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      Off
                    </Badge>
                  ),
                },
                { label: "Sign-in", value: adminPasswordLoginEnabled() ? "Email code or password" : "Passwordless Secure Login" },
                { label: "This device", value: current ? deviceLabel(current.userAgent) : "—" },
                { label: "Signed in with", value: `${signInMethodLabel(me.security.authMethod)}${me.security.mfa ? " · 2FA verified" : ""}` },
                { label: "Active sessions", value: `${sessions.length} device${sessions.length === 1 ? "" : "s"}` },
              ]}
            />
          </CardBody>
          <CardFooter className="justify-end">
            <ButtonLink href="/admin/account/security" variant="outline" size="sm" leftIcon={<ShieldCheck className="h-4 w-4" />}>
              Manage security
            </ButtonLink>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
