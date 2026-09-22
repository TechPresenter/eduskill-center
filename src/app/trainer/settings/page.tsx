import type { Metadata } from "next";
import { Laptop, Smartphone } from "lucide-react";
import { requireTrainer } from "@/lib/auth/guards";
import { trainerSessions } from "@/server/trainer-scope";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { ChangePasswordForm, RevokeOtherSessions } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

function describeAgent(ua: string | null | undefined) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /curl/i.test(ua) ? "curl" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" · ");
}

function isPhone(ua: string | null | undefined) {
  return !!ua && /Android|iPhone|iPad|Mobile/i.test(ua);
}

export default async function TrainerSettingsPage() {
  const user = await requireTrainer();
  const { sessions, loginHistory } = await trainerSessions(user);
  const others = sessions.filter((s) => !s.current).length;

  return (
    <>
      <PageHeader title="Settings" description="Manage your password and the devices logged in to your trainer account." />
      <InactiveBanner status={user.trainer.status} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="self-start">
          <CardHeader title="Change password" description="Changing your password logs out every other device." />
          <CardBody>
            <ChangePasswordForm />
          </CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Active sessions" description={`${sessions.length} device${sessions.length === 1 ? "" : "s"} logged in`} action={<RevokeOtherSessions count={others} />} />
            <ul className="divide-y divide-line">
              {sessions.map((s) => {
                const Icon = isPhone(s.userAgent) ? Smartphone : Laptop;
                return (
                  <li key={s.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-ink">
                        {describeAgent(s.userAgent)}
                        {s.current && <Badge tone="success">This device</Badge>}
                      </p>
                      <p className="text-caption text-muted">
                        IP {s.ip ?? "—"} · Signed in {formatDateTime(s.createdAt)}
                      </p>
                      <p className="text-caption text-muted">
                        Last active {formatDateTime(s.lastSeenAt)} · Expires {formatDateTime(s.expiresAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Recent login activity" description="Last 20 login attempts on your account. Contact the Foundation office if you see anything unfamiliar." />
            <CardBody className="p-0">
              <TableWrap className="md:rounded-none md:border-0 md:shadow-none">
                <THead>
                  <tr>
                    <TH>When</TH>
                    <TH>Result</TH>
                    <TH>Device</TH>
                    <TH>IP</TH>
                  </tr>
                </THead>
                <TBody>
                  {loginHistory.length === 0 ? (
                    <EmptyRow colSpan={4}>No login history yet.</EmptyRow>
                  ) : (
                    loginHistory.map((h) => (
                      <TR key={h.id}>
                        <TD mobile="full">{formatDateTime(h.createdAt)}</TD>
                        <TD>{h.success ? <Badge tone="success">Success</Badge> : <Badge tone="danger">Failed{h.reason ? ` · ${h.reason}` : ""}</Badge>}</TD>
                        <TD>{describeAgent(h.userAgent)}</TD>
                        <TD className="font-mono text-caption">{h.ip ?? "—"}</TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </TableWrap>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
