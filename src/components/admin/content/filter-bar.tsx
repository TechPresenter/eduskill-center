import * as React from "react";
import { Filter } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Server-rendered GET filter form. Selects/inputs submit as query params; no client JS needed.
 */
export function FilterBar({ children, resetHref, className, hidden }: { children: React.ReactNode; resetHref: string; className?: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form method="get" className={cn("card mb-4 p-4", className)} role="search">
      {hidden && Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {children}
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-6">
          <Button type="submit" variant="navy" size="sm" leftIcon={<Filter className="h-4 w-4" />}>
            Apply filters
          </Button>
          <ButtonLink href={resetHref} variant="ghost" size="sm">
            Reset
          </ButtonLink>
        </div>
      </div>
    </form>
  );
}

export function FilterSelect({ name, label, value, options, placeholder = "All", className }: { name: string; label: string; value?: string; options: SelectOption[]; placeholder?: string; className?: string }) {
  const id = `f-${name}`;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      <Select id={id} name={name} defaultValue={value ?? ""} options={options} placeholder={placeholder} className="h-10 py-1.5" />
    </div>
  );
}

export function FilterInput({ name, label, value, placeholder, type = "text", className }: { name: string; label: string; value?: string; placeholder?: string; type?: string; className?: string }) {
  const id = `f-${name}`;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      <Input id={id} name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} className="h-10 py-1.5" />
    </div>
  );
}

/** Reads a single string value from Next `searchParams`. */
export function sp(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s : undefined;
}

/** Builds an href preserving current params with overrides. */
export function hrefWith(base: string, params: Record<string, string | string[] | undefined>, overrides: Record<string, string | number | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) usp.set(k, s);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") usp.delete(k);
    else usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}
