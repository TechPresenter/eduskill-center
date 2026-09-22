import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth/guards";
import { getActiveSessions, getLoginHistory } from "@/server/student-portal";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { ChangePasswordForm, RevokeOtherSessions } from "@/components/student/settings-forms";

export const metadata: Metadata = { title: "Settings" };

function describeAgent(ua: string | null | undefined) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /curl/i.test(ua) ? "curl" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" · ");
}

export default async function StudentSettingsPage() {
  const user = await requireStudent();
  const [history, sessions] = await Promise.all([getLoginHistory(user.id, 10), getActiveSessions(user.id)]);
  const others = sessions.filter((s) => s.id !== user.sessionId).length;

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Settings" mobileTitle="Settings" description="Manage your password and the devices logged in to your account." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="self-start">
          <CardHeader title="Change password" description="Changing your password logs out all other devices." />
          <CardBody>
            <ChangePasswordForm />
          </CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Active sessions" description={`${sessions.length} device${sessions.length === 1 ? "" : "s"} logged in`} action={<RevokeOtherSessions count={others} />} />
            <ul className="divide-y divide-line">
              {sessions.map((s) => {
                const current = s.id === user.sessionId;
                return (
                  <li key={s.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-body-sm font-semibold text-ink">
                        {describeAgent(s.userAgent)}
                        {current && <Badge tone="success">This device</Badge>}
                      </p>
                      <p className="text-caption text-muted">
                        IP {s.ip ?? "—"} · Signed in {formatDateTime(s.createdAt)} · Last active {formatDateTime(s.lastSeenAt)}
                      </p>
                    </div>
                    <p className="text-caption text-muted">Expires {formatDateTime(s.expiresAt)}</p>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Recent login activity" description="Last 10 login attempts on your account. Contact support if you see anything unfamiliar." />
            {/* Phones: a plain list (the 4-column table would need horizontal scrolling). */}
            <ul className="divide-y divide-line md:hidden">
              {history.length === 0 ? (
                <li className="px-4 py-6 text-center text-body-sm text-muted">No login history.</li>
              ) : (
                history.map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-ink">{formatDateTime(h.createdAt)}</p>
                      <p className="truncate text-body-sm text-muted">{describeAgent(h.userAgent)}</p>
                      <p className="font-mono text-caption text-muted">IP {h.ip ?? "—"}</p>
                    </div>
                    {h.success ? <Badge tone="success">Success</Badge> : <Badge tone="danger">Failed</Badge>}
                  </li>
                ))
              )}
            </ul>
            <TableWrap cards={false} className="hidden rounded-none border-0 md:block">
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>Result</TH>
                  <TH>Device</TH>
                  <TH>IP</TH>
                </tr>
              </THead>
              <TBody>
                {history.length === 0 ? (
                  <EmptyRow colSpan={4}>No login history.</EmptyRow>
                ) : (
                  history.map((h) => (
                    <TR key={h.id}>
                      <TD className="text-body-sm">{formatDateTime(h.createdAt)}</TD>
                      <TD>
                        {h.success ? <Badge tone="success">Success</Badge> : <Badge tone="danger">Failed{h.reason ? ` · ${h.reason}` : ""}</Badge>}
                      </TD>
                      <TD className="text-body-sm">{describeAgent(h.userAgent)}</TD>
                      <TD className="font-mono text-caption text-muted">{h.ip ?? "—"}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </TableWrap>
          </Card>
        </div>
      </div>
    </div>
  );
}
