import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime, titleCase } from "@/lib/utils";
import { accountOverview } from "@/app/admin/account/queries";
import { PageHeader, Avatar } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataList, TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { ChangePasswordForm, RevokeOtherSessionsButton } from "@/app/admin/account/account-forms";

export const metadata: Metadata = { title: "My Account · Foundation Admin" };

function deviceLabel(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /Windows/i.test(ua) ? "Windows" : /Mac OS|Macintosh/i.test(ua) ? "macOS" : /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Linux/i.test(ua) ? "Linux" : "Other";
  const browser = /Edg\//i.test(ua) ? "Edge" : /Chrome\//i.test(ua) ? "Chrome" : /Firefox\//i.test(ua) ? "Firefox" : /Safari\//i.test(ua) ? "Safari" : /curl/i.test(ua) ? "curl" : "Browser";
  return `${browser} on ${os}`;
}

export default async function AccountPage() {
  const me = await requireAdmin();
  const { user, sessions, loginHistory } = await accountOverview(me.id, me.sessionId);
  const others = sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar name={user.name} src={user.avatarUrl} size={44} />
            {user.name}
            <Badge tone="navy">{user.role === "SUPER_ADMIN" ? "Super Admin" : (user.staff?.role?.name ?? "Foundation Staff")}</Badge>
          </span>
        }
        mobileTitle="My account"
        description="Your profile, password and active sessions."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Profile" description="Contact the Super Admin to change your name or email." />
            <CardBody>
              {/* One description list, not nine: the profile is a single set of term/value pairs. */}
              <DataList
                className="xl:grid-cols-1"
                items={[
                  { label: "Email", value: user.email ?? "—" },
                  { label: "Mobile", value: user.mobile ?? "—" },
                  { label: "Role", value: user.role === "SUPER_ADMIN" ? "Super Admin (all permissions)" : (user.staff?.role?.name ?? "Staff without role") },
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
            <CardHeader title="Change password" description="Changing your password signs you out of other devices." />
            <CardBody>
              <ChangePasswordForm />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Active sessions" description={`${sessions.length} device${sessions.length === 1 ? "" : "s"} currently signed in.`} action={<RevokeOtherSessionsButton count={others} />} />
            {/* Card mode below md (TableWrap default); md:border-0 keeps the desktop table flush in the Card. */}
            <TableWrap className="rounded-none border-0 md:rounded-none md:border-0">
              <THead>
                <tr>
                  <TH>Device</TH>
                  <TH>IP</TH>
                  <TH>Signed in</TH>
                  <TH>Last active</TH>
                  <TH>Expires</TH>
                </tr>
              </THead>
              <TBody>
                {sessions.map((s) => (
                  <TR key={s.id}>
                    <TD primary>
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {deviceLabel(s.userAgent)}
                        {s.current && <Badge tone="success">This device</Badge>}
                      </span>
                      <span className="block truncate text-body-sm font-normal text-muted md:max-w-xs" title={s.userAgent ?? undefined}>
                        {s.userAgent ?? "—"}
                      </span>
                    </TD>
                    <TD label="IP" className="font-mono text-body-sm">{s.ip ?? "—"}</TD>
                    <TD label="Signed in" className="text-muted md:whitespace-nowrap">{formatDateTime(s.createdAt)}</TD>
                    <TD label="Last active" className="text-muted md:whitespace-nowrap">{formatDateTime(s.lastSeenAt)}</TD>
                    <TD label="Expires" className="text-muted md:whitespace-nowrap">{formatDateTime(s.expiresAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </Card>

          <Card>
            <CardHeader title="Login history" description="Your latest 15 login attempts." />
            <TableWrap className="rounded-none border-0 md:rounded-none md:border-0">
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>Result</TH>
                  <TH>Identifier</TH>
                  <TH>IP</TH>
                  <TH>Device</TH>
                </tr>
              </THead>
              <TBody>
                {loginHistory.length === 0 && <EmptyRow colSpan={5}>No login attempts recorded.</EmptyRow>}
                {loginHistory.map((h) => (
                  <TR key={h.id}>
                    <TD primary className="md:whitespace-nowrap">{formatDateTime(h.createdAt)}</TD>
                    <TD label="Result">
                      <Badge tone={h.success ? "success" : "danger"} dot>
                        {h.success ? "Success" : `Failed${h.reason ? ` · ${titleCase(h.reason)}` : ""}`}
                      </Badge>
                    </TD>
                    <TD label="Identifier" className="text-body-sm break-all">{h.identifier}</TD>
                    <TD label="IP" className="font-mono text-body-sm">{h.ip ?? "—"}</TD>
                    <TD label="Device" className="text-body-sm text-muted">{deviceLabel(h.userAgent)}</TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </Card>
        </div>
      </div>
    </div>
  );
}
