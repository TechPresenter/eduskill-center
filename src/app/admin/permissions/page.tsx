import type { Metadata } from "next";
import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { formatNumber } from "@/lib/utils";
import { permissionCatalog } from "@/server/roles";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";

export const metadata: Metadata = { title: "Permissions · Foundation Admin" };

export default async function PermissionsPage() {
  await requireAdmin("roles.view");
  const catalog = await permissionCatalog();
  const total = catalog.reduce((n, m) => n + m.permissions.length, 0);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Permission catalog"
        mobileTitle="Permissions"
        description={`${formatNumber(total)} permissions across ${catalog.length} modules. Permissions are defined in code (module.action); roles and direct grants reference them.`}
        actions={
          <ButtonLink href="/admin/roles" variant="outline" size="sm">
            Manage roles
          </ButtonLink>
        }
      />
      <Alert tone="info">The Super Admin implicitly holds every permission and cannot be restricted. Staff receive permissions through their role plus any direct grants on their profile.</Alert>

      {/* Phones / tablets: one collapsible card per module — 200+ table rows would otherwise stack into an endless list. */}
      <div className="space-y-2 md:hidden">
        {catalog.map((m) => (
          <details key={m.key} className="group rounded-2xl border border-line bg-white shadow-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 tap-highlight-none active:bg-surface">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-navy">{m.label}</span>
                <span className="block font-mono text-xs text-muted">{m.key}</span>
              </span>
              <span className="rounded-full bg-lavender px-2 py-0.5 text-xs font-bold text-navy tabular-nums">{m.permissions.length}</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {m.permissions.map((p) => (
                <li key={p.key} className="px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{p.label}</p>
                  <p className="mt-0.5 font-mono text-xs break-all text-muted">{p.key}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {p.roles.length === 0 ? (
                      <span className="text-xs text-muted">No role holds this</span>
                    ) : (
                      p.roles.map((r) => (
                        <Link key={r.id} href={`/admin/roles/${r.id}`} className="inline-flex min-h-8 items-center">
                          <Badge tone={r.isSystem ? "navy" : "neutral"}>{r.name}</Badge>
                        </Link>
                      ))
                    )}
                    {p.directStaffCount > 0 && <Badge tone="orange">{p.directStaffCount} direct grant{p.directStaffCount === 1 ? "" : "s"}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      {/* Desktop: the full matrix table (unchanged). */}
      <div className="hidden md:block">
        <TableWrap cards={false}>
          <THead>
            <tr>
              <TH>Permission</TH>
              <TH>Key</TH>
              <TH>Roles that hold it</TH>
              <TH className="text-right">Direct staff grants</TH>
            </tr>
          </THead>
          <TBody>
            {catalog.map((m) => (
              <React.Fragment key={m.key}>
                <tr className="bg-surface/70">
                  <td colSpan={4} className="px-4 py-2 text-xs font-bold tracking-wide text-navy uppercase">
                    {m.label} <span className="font-mono font-normal text-muted normal-case">({m.key})</span>
                  </td>
                </tr>
                {m.permissions.map((p) => (
                  <TR key={p.key}>
                    <TD className="font-medium">{p.label}</TD>
                    <TD className="font-mono text-xs text-muted">{p.key}</TD>
                    <TD>
                      {p.roles.length === 0 ? (
                        <span className="text-xs text-muted">No role</span>
                      ) : (
                        <span className="flex flex-wrap gap-1.5">
                          {p.roles.map((r) => (
                            <Link key={r.id} href={`/admin/roles/${r.id}`}>
                              <Badge tone={r.isSystem ? "navy" : "neutral"} className="hover:border-navy/40">
                                {r.name}
                              </Badge>
                            </Link>
                          ))}
                        </span>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums">{p.directStaffCount}</TD>
                  </TR>
                ))}
              </React.Fragment>
            ))}
          </TBody>
        </TableWrap>
      </div>
    </div>
  );
}
