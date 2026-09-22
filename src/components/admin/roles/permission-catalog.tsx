"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, KeySquare, Minus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import { IconTile } from "@/components/admin/content/app-list";

export interface CatalogRole {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface CatalogPermission {
  key: string;
  label: string;
  roles: CatalogRole[];
  directStaffCount: number;
}

export interface CatalogModule {
  key: string;
  label: string;
  permissions: CatalogPermission[];
}

type Holder = "all" | "held" | "unheld";

/**
 * The permission catalog, read-only. Phones: one accordion per module whose rows list the roles that
 * hold each permission. Desktop (lg+): a true roles × permissions matrix — module group rows, a sticky
 * first column and one column per role — inside its own horizontal scroller, so the page never scrolls
 * sideways. A search box and a "held by / not held by any role" switch narrow both views.
 */
export function PermissionCatalog({ modules, roles }: { modules: CatalogModule[]; roles: CatalogRole[] }) {
  const [query, setQuery] = React.useState("");
  const [holder, setHolder] = React.useState<Holder>("all");
  const needle = query.trim().toLowerCase();

  const filtered = modules
    .map((m) => ({
      ...m,
      permissions: m.permissions.filter((p) => {
        if (holder === "held" && p.roles.length === 0) return false;
        if (holder === "unheld" && p.roles.length > 0) return false;
        if (!needle) return true;
        return `${m.label} ${p.label} ${p.key}`.toLowerCase().includes(needle);
      }),
    }))
    .filter((m) => m.permissions.length > 0);
  const shown = filtered.reduce((n, m) => n + m.permissions.length, 0);
  const total = modules.reduce((n, m) => n + m.permissions.length, 0);
  const narrowing = !!needle || holder !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:w-96">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search permissions, e.g. payments or export"
            aria-label="Search permissions"
            leftIcon={<Search className="h-4 w-4" />}
            rightIcon={
              query ? (
                <button type="button" onClick={() => setQuery("")} className="ring-focus -mr-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:text-ink" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              ) : undefined
            }
          />
        </div>
        <SegmentedControl
          scrollable
          className="max-w-full"
          value={holder}
          onChange={(v) => setHolder(v as Holder)}
          items={[
            { value: "all", label: "All" },
            { value: "held", label: "Held by a role" },
            { value: "unheld", label: "Not held" },
          ]}
        />
      </div>
      <p className="text-caption text-muted tabular-nums" role="status" aria-atomic="true">
        {narrowing ? `Showing ${shown} of ${total} permissions` : `${total} permissions in ${modules.length} modules`}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Search className="h-6 w-6" />}
          title="No permissions match"
          description="Try another word or show every permission."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setHolder("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          {/* Phones / tablets: accordions. Opened automatically while searching. */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((m) => (
              <details key={m.key} open={narrowing || undefined} className="group card overflow-hidden">
                <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 tap-highlight-none transition-colors duration-micro ease-soft active:bg-surface motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
                  <IconTile>
                    <KeySquare />
                  </IconTile>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-ink">{m.label}</span>
                    <span className="block font-mono text-caption text-muted">{m.key}</span>
                  </span>
                  <span className="rounded-full bg-lavender px-2.5 py-0.5 text-caption font-bold text-navy tabular-nums">{m.permissions.length}</span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-micro group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <ul className="divide-y divide-line border-t border-line">
                  {m.permissions.map((p) => (
                    <li key={p.key} className="px-4 py-3">
                      <p className="text-body-sm font-semibold text-ink">{p.label}</p>
                      <p className="mt-0.5 font-mono text-caption break-all text-muted">{p.key}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {p.roles.length === 0 ? (
                          <span className="text-caption text-muted">No role holds this</span>
                        ) : (
                          p.roles.map((r) => (
                            <Link key={r.id} href={`/admin/roles/${r.id}`} className="ring-focus inline-flex min-h-11 items-center rounded-full">
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

          {/* Desktop: roles × permissions matrix. */}
          <div className="card relative hidden overflow-hidden lg:block">
            <div className="scrollbar-thin relative max-h-[70vh] overflow-auto">
              <table className="w-full min-w-max border-separate border-spacing-0 text-left text-body-sm">
                <thead className="sticky top-0 z-raised bg-surface">
                  <tr>
                    <th scope="col" className="sticky left-0 z-raised min-w-64 border-b border-line bg-surface px-4 py-3 text-caption font-semibold tracking-wide text-muted uppercase">
                      Permission
                    </th>
                    {roles.map((r) => (
                      <th key={r.id} scope="col" className="border-b border-line px-3 py-3 text-center align-bottom">
                        <Link href={`/admin/roles/${r.id}`} className="ring-focus inline-block max-w-28 rounded-md text-caption font-semibold break-words text-navy hover:underline">
                          {r.name}
                        </Link>
                      </th>
                    ))}
                    <th scope="col" className="border-b border-line px-3 py-3 text-center text-caption font-semibold text-muted">
                      Direct grants
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <React.Fragment key={m.key}>
                      <tr>
                        <th scope="colgroup" colSpan={roles.length + 2} className="sticky left-0 border-b border-line bg-lavender/60 px-4 py-2 text-left text-overline text-navy">
                          {m.label} <span className="font-mono font-normal tracking-normal text-muted normal-case">({m.key})</span>
                        </th>
                      </tr>
                      {m.permissions.map((p) => {
                        const holders = new Set(p.roles.map((r) => r.id));
                        return (
                          <tr key={p.key} className="transition-colors duration-micro hover:bg-surface/70 motion-reduce:transition-none">
                            <th scope="row" className="sticky left-0 border-b border-line bg-white px-4 py-2.5 font-normal">
                              <span className="block font-medium text-ink">{p.label}</span>
                              <span className="block font-mono text-caption text-muted">{p.key}</span>
                            </th>
                            {roles.map((r) => (
                              <td key={r.id} className="border-b border-line px-3 py-2.5 text-center">
                                {holders.has(r.id) ? (
                                  <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full", r.isSystem ? "bg-navy text-white" : "bg-orange-light text-orange")} title={`${r.name} holds ${p.key}`}>
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                                    <span className="sr-only">Granted</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex h-6 w-6 items-center justify-center text-line" title={`${r.name} does not hold ${p.key}`}>
                                    <Minus className="h-3.5 w-3.5" aria-hidden />
                                    <span className="sr-only">Not granted</span>
                                  </span>
                                )}
                              </td>
                            ))}
                            <td className="border-b border-line px-3 py-2.5 text-center tabular-nums">{p.directStaffCount || <span className="text-muted">–</span>}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
