"use client";

import * as React from "react";
import { DynamicIcon, ICON_NAMES } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Grid picker for the CMS-safe lucide icon set (see src/components/ui/icon.tsx). */
export function IconPicker({ value, onChange, disabled, id }: { value: string; onChange: (name: string) => void; disabled?: boolean; id?: string }) {
  const [filter, setFilter] = React.useState("");
  const names = ICON_NAMES.filter((n) => n.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lavender text-navy" aria-hidden>
          <DynamicIcon name={value || undefined} className="h-5 w-5" />
        </span>
        <Input id={id} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search icons…" disabled={disabled} aria-label="Search icons" />
        {value && (
          <button type="button" className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-muted tap-highlight-none md:min-h-0 md:hover:text-danger" onClick={() => onChange("")} disabled={disabled}>
            Clear
          </button>
        )}
      </div>
      <div role="listbox" aria-label="Icons" className="scrollbar-thin grid max-h-56 grid-cols-5 gap-1.5 overflow-y-auto rounded-xl border border-line bg-white p-2 sm:max-h-44 sm:grid-cols-8 md:grid-cols-10">
        {names.map((n) => (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={value === n}
            title={n}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn("flex h-11 items-center justify-center rounded-lg border text-ink transition-colors tap-highlight-none sm:h-9", value === n ? "border-orange bg-orange-light text-orange" : "border-transparent active:bg-surface sm:hover:bg-surface")}
          >
            <DynamicIcon name={n} className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        ))}
        {names.length === 0 && <p className="col-span-full py-4 text-center text-xs text-muted">No icons match.</p>}
      </div>
      <p className="text-xs text-muted">{value ? `Selected: ${value}` : "No icon selected (a default sparkle is shown)."}</p>
    </div>
  );
}
