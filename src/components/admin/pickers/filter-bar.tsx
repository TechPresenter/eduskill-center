"use client";

import * as React from "react";
import { cn, formatDate, titleCase } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { FilterBar as FilterShell, FilterLabel, LocationFilter, SearchInput, SelectFilter, useFilterField } from "@/components/admin/shared/filter-bar";
import type { AdminLookups } from "@/server/admissions";

/*
 * The config-driven face of the filter bar: `<FilterBar fields={[…]} lookups={…} />`.
 *
 * It used to be a second, parallel implementation — its own sticky toolbar, its own sheet, its own
 * draft state and a search box that only applied on Enter while the other bar applied on a debounce.
 * It is now a thin adapter that turns each `FilterField` into a control and hands them to the one
 * engine in `@/components/admin/shared/filter-bar`, so every admin list page filters identically.
 * The props here are unchanged, so the seventeen pages using it did not have to move.
 *
 * What this file still owns, because only it knows about them: the picker field types (centre, course,
 * batch, trainer, programme) and the fact that choosing a centre or a course invalidates the batch.
 */

export type FilterField =
  | { type: "search"; name?: string; placeholder?: string; label?: string }
  | { type: "select"; name: string; label: string; options: SelectOption[]; placeholder?: string }
  | { type: "center"; label?: string; activeOnly?: boolean }
  | { type: "course"; label?: string }
  | { type: "batch"; label?: string; statuses?: string[] }
  | { type: "trainer"; label?: string }
  | { type: "program"; label?: string }
  | { type: "location"; depth?: "state" | "district" | "block" }
  | { type: "date-range"; label?: string; fromName?: string; toName?: string };

interface FilterBarProps {
  fields: FilterField[];
  /** Server-loaded lookups (centers, courses, batches, trainers, programs). Required for the picker field types. */
  lookups?: AdminLookups | null;
  /** Query keys that must survive "Reset" (e.g. `tab`, `status`). */
  preserve?: string[];
  className?: string;
}

/** A select bound to one query key that also clears the keys it invalidates. */
function DependentSelect({ name, label, options, placeholder, clears = [], disabled, className }: { name: string; label: string; options: SelectOption[]; placeholder: string; clears?: string[]; disabled?: boolean; className?: string }) {
  const { get, set, inSheet } = useFilterField();
  const id = `filter-${name}`;
  return (
    <div className={cn(inSheet ? "w-full min-w-0" : "min-w-[12rem]", className)}>
      <FilterLabel htmlFor={id}>{label}</FilterLabel>
      <Select
        id={id}
        name={name}
        value={get(name)}
        disabled={disabled}
        onChange={(e) => set({ [name]: e.target.value || undefined, ...Object.fromEntries(clears.map((k) => [k, undefined])) })}
        options={options}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Two date fields bound to a pair of query keys. Each applies as soon as it changes. */
function DateRangeFields({ label = "Date range", fromName, toName }: { label?: string; fromName: string; toName: string }) {
  const { get, set, inSheet } = useFilterField();
  const from = get(fromName);
  const to = get(toName);
  return (
    <div className={cn(inSheet ? "w-full min-w-0" : "min-w-[16rem]")}>
      <FilterLabel as="span">{label}</FilterLabel>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" aria-label={`${label}: from`} value={from} max={to || undefined} onChange={(e) => set({ [fromName]: e.target.value || undefined })} />
        <Input type="date" aria-label={`${label}: to`} value={to} min={from || undefined} onChange={(e) => set({ [toName]: e.target.value || undefined })} />
      </div>
    </div>
  );
}

/** Batch options depend on the centre and course the user has already chosen — including in the sheet draft. */
function BatchSelect({ label = "Batch", statuses, lookups }: { label?: string; statuses?: string[]; lookups?: AdminLookups | null }) {
  const { get } = useFilterField();
  const centerId = get("centerId");
  const courseId = get("courseId");
  const options = (lookups?.batches ?? [])
    .filter((b) => (!centerId || b.centerId === centerId) && (!courseId || b.courseId === courseId) && (!statuses || statuses.includes(b.status)))
    .map((b) => ({ value: b.id, label: `${b.code} · ${b.name} · ${titleCase(b.status)} · ${formatDate(b.startDate, "dd MMM yy")}` }));
  return <DependentSelect name="batchId" label={label} options={options} placeholder={options.length ? "All batches" : "No batches"} disabled={options.length === 0 && !get("batchId")} className="min-w-[14rem]" />;
}

function Field({ field, lookups }: { field: Exclude<FilterField, { type: "search" }>; lookups?: AdminLookups | null }) {
  switch (field.type) {
    case "select":
      return <SelectFilter name={field.name} label={field.label} options={field.options} placeholder={field.placeholder ?? "All"} />;
    case "center": {
      const options = (lookups?.centers ?? []).filter((c) => !field.activeOnly || c.status === "ACTIVE").map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }));
      // Changing the centre invalidates the batch, which belongs to one centre.
      return <DependentSelect name="centerId" label={field.label ?? "Training center"} options={options} placeholder="All centers" clears={["batchId"]} className="min-w-[14rem]" />;
    }
    case "course": {
      const options = (lookups?.courses ?? []).map((c) => ({ value: c.id, label: `${c.name}${c.status !== "ACTIVE" ? ` · ${titleCase(c.status)}` : ""}` }));
      return <DependentSelect name="courseId" label={field.label ?? "Course"} options={options} placeholder="All courses" clears={["batchId"]} className="min-w-[13rem]" />;
    }
    case "batch":
      return <BatchSelect label={field.label} statuses={field.statuses} lookups={lookups} />;
    case "trainer":
      return <SelectFilter name="trainerId" label={field.label ?? "Trainer"} options={(lookups?.trainers ?? []).map((t) => ({ value: t.id, label: `${t.name} (${t.trainerId})` }))} placeholder="All trainers" className="min-w-[13rem]" />;
    case "program":
      return <SelectFilter name="programId" label={field.label ?? "Program"} options={(lookups?.programs ?? []).map((p) => ({ value: p.id, label: p.name }))} placeholder="All programs" className="min-w-[13rem]" />;
    case "location":
      return <LocationFilter depth={field.depth ?? "block"} />;
    case "date-range":
      return <DateRangeFields label={field.label} fromName={field.fromName ?? "from"} toName={field.toName ?? "to"} />;
  }
}

export function FilterBar({ fields, lookups, preserve = [], className }: FilterBarProps) {
  const search = fields.find((f): f is Extract<FilterField, { type: "search" }> => f.type === "search");
  const rest = fields.filter((f): f is Exclude<FilterField, { type: "search" }> => f.type !== "search");

  return (
    <FilterShell
      className={className}
      preserve={preserve}
      search={search ? <SearchInput name={search.name ?? "q"} placeholder={search.placeholder ?? "Search…"} label={search.label ?? "Search"} /> : undefined}
    >
      {rest.map((f, i) => (
        <Field key={`${f.type}-${i}`} field={f} lookups={lookups} />
      ))}
    </FilterShell>
  );
}
