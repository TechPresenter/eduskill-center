"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { PERMISSION_MODULES } from "@/lib/rbac/permissions";
import { Checkbox, CheckboxCards } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  update: "Edit",
  delete: "Delete",
  import: "Import",
  export: "Export",
  verify: "Verify",
  approve: "Approve",
  reject: "Reject",
  assign: "Assign",
  refund: "Refund",
  mark: "Mark",
  issue: "Issue",
  revoke: "Revoke",
  publish: "Publish",
  send: "Send",
  templates: "Templates",
  respond: "Respond",
};

const actionLabel = (key: string) => {
  const action = key.split(".")[1] ?? key;
  return ACTION_LABELS[action] ?? action;
};

/**
 * Permission checkboxes grouped by module with a select-all per module.
 * `inherited` keys (e.g. from a role) are shown as granted but not editable.
 *
 * Below `lg` the matrix becomes a list of module accordions (`<details>`) whose actions are 56px
 * CheckboxCards — the desktop grid would need horizontal scrolling on a phone. Both layouts write
 * exactly the same `string[]` through `onChange`, so the API payload is identical either way.
 */
export function PermissionMatrix({ value, onChange, inherited = [], disabled, className, compact }: { value: string[]; onChange: (keys: string[]) => void; inherited?: string[]; disabled?: boolean; className?: string; compact?: boolean }) {
  const selected = React.useMemo(() => new Set(value), [value]);
  const inh = React.useMemo(() => new Set(inherited), [inherited]);
  const toggle = (key: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    onChange(Array.from(next).sort());
  };
  const toggleModule = (keys: string[], on: boolean) => {
    const next = new Set(selected);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(Array.from(next).sort());
  };
  /** Applies a CheckboxCards selection for one module without touching the other modules' keys. */
  const setModule = (editable: string[], next: string[]) => {
    const out = new Set(selected);
    for (const k of editable) {
      if (next.includes(k)) out.add(k);
      else out.delete(k);
    }
    onChange(Array.from(out).sort());
  };
  const allKeys = PERMISSION_MODULES.flatMap((m) => m.actions.map((a) => `${m.key}.${a}`));
  const everything = allKeys.every((k) => selected.has(k) || inh.has(k));

  const modules = PERMISSION_MODULES.map((m) => {
    const keys = m.actions.map((a) => `${m.key}.${a}`);
    const editable = keys.filter((k) => !inh.has(k));
    const granted = keys.filter((k) => selected.has(k) || inh.has(k));
    return { ...m, keys, editable, granted };
  });

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {selected.size} selected{inherited.length ? ` · ${inherited.length} inherited from role` : ""}
        </span>
        {!disabled && (
          <div className="-mr-2 flex items-center gap-1">
            <button type="button" className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-navy tap-highlight-none active:bg-surface hover:underline lg:min-h-0" onClick={() => toggleModule(allKeys, true)} disabled={everything}>
              Select all
            </button>
            <button type="button" className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-navy tap-highlight-none active:bg-surface hover:underline lg:min-h-0" onClick={() => onChange([])} disabled={selected.size === 0}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Phones / tablets: one collapsible card per module with 56px action cards. */}
      <div className="space-y-2 lg:hidden">
        {modules.map((m) => (
          <details key={m.key} className="group rounded-2xl border border-line bg-white open:shadow-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 tap-highlight-none active:bg-surface">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-navy">{m.label}</span>
                <span className="block text-xs text-muted">
                  {m.granted.length} of {m.keys.length} granted
                </span>
              </span>
              {m.granted.length > 0 && <span className="rounded-full bg-orange-light px-2 py-0.5 text-xs font-bold text-orange tabular-nums">{m.granted.length}</span>}
              <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <div className="space-y-3 border-t border-line px-4 py-3">
              {!disabled && m.editable.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => toggleModule(m.editable, true)} className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-xs font-semibold text-navy tap-highlight-none active:bg-surface">
                    Grant all
                  </button>
                  <button type="button" onClick={() => toggleModule(m.editable, false)} className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-xs font-semibold text-muted tap-highlight-none active:bg-surface">
                    Clear module
                  </button>
                </div>
              )}
              <CheckboxCards
                name={`perm-${m.key}`}
                columns={2}
                value={m.granted}
                onChange={(next) => setModule(m.editable, next)}
                options={m.keys.map((k) => ({
                  value: k,
                  label: actionLabel(k),
                  description: inh.has(k) ? "Via role" : undefined,
                  disabled: disabled || inh.has(k),
                }))}
              />
            </div>
          </details>
        ))}
      </div>

      {/* Desktop: the original module grid. */}
      <div className={cn("hidden gap-3 lg:grid", compact ? "lg:grid-cols-2" : "lg:grid-cols-2 xl:grid-cols-3")}>
        {modules.map((m) => {
          const allOn = m.editable.length > 0 && m.editable.every((k) => selected.has(k));
          const someOn = m.editable.some((k) => selected.has(k));
          return (
            <fieldset key={m.key} className="rounded-xl border border-line bg-white p-3">
              <legend className="sr-only">{m.label}</legend>
              <div className="mb-2 flex items-start justify-between gap-2 border-b border-line pb-2">
                <p className="text-sm font-semibold text-navy">{m.label}</p>
                {m.editable.length > 0 && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-line accent-orange"
                      checked={allOn}
                      ref={(el) => {
                        if (el) el.indeterminate = !allOn && someOn;
                      }}
                      disabled={disabled}
                      onChange={(e) => toggleModule(m.editable, e.target.checked)}
                      aria-label={`Select all ${m.label} permissions`}
                    />
                    All
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {m.keys.map((k) => {
                  const isInherited = inh.has(k);
                  return (
                    <Checkbox
                      key={k}
                      checked={isInherited || selected.has(k)}
                      disabled={disabled || isInherited}
                      onChange={(e) => toggle(k, e.target.checked)}
                      label={<span className={cn("text-xs", isInherited && "text-muted")}>{actionLabel(k)}</span>}
                      description={isInherited ? <span className="text-[10px]">via role</span> : undefined}
                      className="items-center"
                    />
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
