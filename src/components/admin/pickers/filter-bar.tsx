"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { cn, formatDate, titleCase } from "@/lib/utils";
import { Select, type SelectOption } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { LocationCascade } from "@/components/shared/location-cascade";
import type { AdminLookups } from "@/server/admissions";

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

const LOCATION_KEYS = ["stateId", "districtId", "blockId"];

function keysOf(f: FilterField): string[] {
  switch (f.type) {
    case "search":
      return [f.name ?? "q"];
    case "select":
      return [f.name];
    case "center":
      return ["centerId"];
    case "course":
      return ["courseId"];
    case "batch":
      return ["batchId"];
    case "trainer":
      return ["trainerId"];
    case "program":
      return ["programId"];
    case "location":
      return LOCATION_KEYS;
    case "date-range":
      return [f.fromName ?? "from", f.toName ?? "to"];
  }
}

const labelCls = "mb-1 block text-[11px] font-semibold tracking-wide text-muted uppercase";

/** Sticks the phone toolbar right below the 56px app bar (which carries `pt-safe`). */
const STICKY_TOP = "top-[calc(3.5rem+env(safe-area-inset-top,0px))]";

/**
 * Filter bar that writes its values into the URL (`?key=value`) so server pages re-render with the new query.
 *
 * Desktop (lg+): the familiar card with a responsive grid of controls; selects apply immediately and the
 * search box applies on Enter / "Apply search".
 *
 * Phones and tablets (< lg): a sticky app-style toolbar with the search field and a `Filters (n)` button that opens a
 * BottomSheet holding every other control stacked full-width. Sheet edits go into a local draft and are
 * pushed to the URL once, on "Show results", so no server round-trip happens per tap.
 */
export function FilterBar({ fields, lookups, preserve = [], className }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string | undefined>>({});
  const searchField = fields.find((f): f is Extract<FilterField, { type: "search" }> => f.type === "search");
  const searchKey = searchField?.name ?? "q";
  const urlSearch = sp.get(searchKey) ?? "";
  const [search, setSearch] = React.useState(urlSearch);
  const [syncedSearch, setSyncedSearch] = React.useState(urlSearch);
  if (urlSearch !== syncedSearch) {
    // URL changed (back/forward, reset, tab switch) – adopt the new value.
    setSyncedSearch(urlSearch);
    setSearch(urlSearch);
  }

  const get = (k: string) => sp.get(k) ?? "";

  const apply = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  const reset = () => {
    const next = new URLSearchParams();
    for (const k of preserve) {
      const v = sp.get(k);
      if (v) next.set(k, v);
    }
    setSearch("");
    setDraft({});
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  /* ── Draft values used inside the sheet (one router push on "Show results") ── */
  const draftGet = (k: string) => (k in draft ? (draft[k] ?? "") : get(k));
  const draftSet = (updates: Record<string, string | undefined>) => setDraft((d) => ({ ...d, ...updates }));

  const openSheet = () => {
    setDraft({});
    setSheetOpen(true);
  };
  const closeSheet = () => {
    setDraft({});
    setSheetOpen(false);
  };
  const showResults = () => {
    const updates = draft;
    setDraft({});
    setSheetOpen(false);
    if (Object.keys(updates).length) apply(updates);
  };

  const allKeys = fields.flatMap(keysOf);
  const active = allKeys.filter((k) => sp.get(k)).length;
  const draftActive = allKeys.filter((k) => draftGet(k)).length;
  const sheetFields = fields.filter((f) => f.type !== "search");

  const optionsFor = (gv: (k: string) => string) => {
    const centerId = gv("centerId");
    const courseId = gv("courseId");
    const batchField = fields.find((f): f is Extract<FilterField, { type: "batch" }> => f.type === "batch");
    return {
      centerId,
      courseId,
      centers: (lookups?.centers ?? [])
        .filter((c) => !fields.some((f) => f.type === "center" && f.activeOnly) || c.status === "ACTIVE")
        .map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })) as SelectOption[],
      courses: (lookups?.courses ?? []).map((c) => ({ value: c.id, label: `${c.name}${c.status !== "ACTIVE" ? ` · ${titleCase(c.status)}` : ""}` })) as SelectOption[],
      batches: (lookups?.batches ?? [])
        .filter((b) => (!centerId || b.centerId === centerId) && (!courseId || b.courseId === courseId) && (!batchField?.statuses || batchField.statuses.includes(b.status)))
        .map((b) => ({ value: b.id, label: `${b.code} · ${b.name} · ${titleCase(b.status)} · ${formatDate(b.startDate, "dd MMM yy")}` })) as SelectOption[],
      trainers: (lookups?.trainers ?? []).map((t) => ({ value: t.id, label: `${t.name} (${t.trainerId})` })) as SelectOption[],
      programs: (lookups?.programs ?? []).map((p) => ({ value: p.id, label: p.name })) as SelectOption[],
    };
  };

  /** Renders one field. `sheet` switches to the stacked, draft-backed variant used inside the BottomSheet. */
  const renderField = (f: FilterField, i: number, sheet: boolean) => {
    const gv = sheet ? draftGet : get;
    const sv = sheet ? draftSet : apply;
    const idFor = (k: string) => `filter-${sheet ? "s-" : ""}${k}`;
    const o = optionsFor(gv);
    switch (f.type) {
      case "search":
        return (
          <div key={i} className={sheet ? undefined : "sm:col-span-2"}>
            {renderSearch(idFor(searchKey), f.label ?? "Search", f.placeholder ?? "Search…")}
          </div>
        );
      case "select":
        return (
          <div key={i}>
            <label className={labelCls} htmlFor={idFor(f.name)}>
              {f.label}
            </label>
            <Select id={idFor(f.name)} value={gv(f.name)} onChange={(e) => sv({ [f.name]: e.target.value || undefined })} options={f.options} placeholder={f.placeholder ?? "All"} />
          </div>
        );
      case "center":
        return (
          <div key={i}>
            <label className={labelCls} htmlFor={idFor("centerId")}>
              {f.label ?? "Training center"}
            </label>
            <Select id={idFor("centerId")} value={o.centerId} onChange={(e) => sv({ centerId: e.target.value || undefined, batchId: undefined })} options={o.centers} placeholder="All centers" />
          </div>
        );
      case "course":
        return (
          <div key={i}>
            <label className={labelCls} htmlFor={idFor("courseId")}>
              {f.label ?? "Course"}
            </label>
            <Select id={idFor("courseId")} value={o.courseId} onChange={(e) => sv({ courseId: e.target.value || undefined, batchId: undefined })} options={o.courses} placeholder="All courses" />
          </div>
        );
      case "batch":
        return (
          <div key={i}>
            <label className={labelCls} htmlFor={idFor("batchId")}>
              {f.label ?? "Batch"}
            </label>
            <Select
              id={idFor("batchId")}
              value={gv("batchId")}
              onChange={(e) => sv({ batchId: e.target.value || undefined })}
              options={o.batches}
              placeholder={o.batches.length ? "All batches" : "No batches"}
              disabled={o.batches.length === 0 && !gv("batchId")}
            />
          </div>
        );
      case "trainer":
        return (
          <div key={i}>
            <label className={labelCls} htmlFor={idFor("trainerId")}>
              {f.label ?? "Trainer"}
            </label>
            <Select id={idFor("trainerId")} value={gv("trainerId")} onChange={(e) => sv({ trainerId: e.target.value || undefined })} options={o.trainers} placeholder="All trainers" />
          </div>
        );
      case "program":
        return (
          <div key={i}>
            <label className={labelCls} htmlFor={idFor("programId")}>
              {f.label ?? "Program"}
            </label>
            <Select id={idFor("programId")} value={gv("programId")} onChange={(e) => sv({ programId: e.target.value || undefined })} options={o.programs} placeholder="All programs" />
          </div>
        );
      case "location": {
        const depth = f.depth ?? "block";
        return (
          <div key={i} className={sheet ? undefined : cn("sm:col-span-2", depth === "block" && "lg:col-span-3")}>
            <span className={labelCls}>Location</span>
            <LocationCascade
              bare
              depth={depth}
              value={{ stateId: gv("stateId") || undefined, districtId: gv("districtId") || undefined, blockId: gv("blockId") || undefined }}
              onChange={(v) => sv({ stateId: v.stateId, districtId: v.districtId, blockId: v.blockId })}
              className={cn("grid grid-cols-1 gap-2", !sheet && (depth === "block" ? "sm:grid-cols-3" : depth === "district" ? "sm:grid-cols-2" : ""))}
              placeholderPrefix="All"
            />
          </div>
        );
      }
      case "date-range": {
        const fromName = f.fromName ?? "from";
        const toName = f.toName ?? "to";
        return (
          <div key={i} className={sheet ? undefined : "sm:col-span-2"}>
            <span className={labelCls}>{f.label ?? "Date range"}</span>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" aria-label="From date" value={gv(fromName)} max={gv(toName) || undefined} onChange={(e) => sv({ [fromName]: e.target.value || undefined })} />
              <Input type="date" aria-label="To date" value={gv(toName)} min={gv(fromName) || undefined} onChange={(e) => sv({ [toName]: e.target.value || undefined })} />
            </div>
          </div>
        );
      }
    }
  };

  /** The search control (rendered twice: once in the desktop grid, once in the phone toolbar – distinct ids). */
  function renderSearch(id: string, label: string, placeholder: string) {
    return (
      <>
        <label className={cn(labelCls, id.includes("-m-") && "sr-only")} htmlFor={id}>
          {label}
        </label>
        <Input
          id={id}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          inputMode="search"
          enterKeyHint="search"
          leftIcon={<Search className="h-4 w-4" />}
          rightIcon={
            search ? (
              <button
                type="button"
                aria-label="Clear search"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:text-navy"
                onClick={() => {
                  setSearch("");
                  apply({ [searchKey]: undefined });
                }}
              >
                <X className="h-4 w-4" />
              </button>
            ) : undefined
          }
        />
      </>
    );
  }

  return (
    <>
      <form
        className={cn(
          // Phones / tablets: a sticky one-line toolbar under the app bar, bleeding into the page gutter.
          "sticky z-20 mb-4 -mx-4 flex flex-col gap-2 bg-surface/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6",
          STICKY_TOP,
          // lg+: the original inline filter card, unchanged.
          "lg:card lg:static lg:mx-0 lg:block lg:p-4 lg:backdrop-blur-none",
          className
        )}
        onSubmit={(e) => {
          e.preventDefault();
          apply({ [searchKey]: search.trim() || undefined });
        }}
        role="search"
        aria-label="Filters"
      >
        {/* ── Phone toolbar: search + Filters sheet trigger ── */}
        <div className="flex items-center gap-2 lg:hidden">
          {searchField && <div className="min-w-0 flex-1">{renderSearch(`filter-m-${searchKey}`, searchField.label ?? "Search", searchField.placeholder ?? "Search…")}</div>}
          {sheetFields.length > 0 && (
            <button
              type="button"
              onClick={openSheet}
              aria-haspopup="dialog"
              className={cn(
                "relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy tap-highlight-none active:bg-surface",
                !searchField && "w-full justify-center"
              )}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <SlidersHorizontal className="h-4 w-4" aria-hidden />}
              Filters
              {active > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1.5 text-[11px] font-bold text-white">{active}</span>}
            </button>
          )}
        </div>
        {active > 0 && (
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <span className="text-xs text-muted">
              {active} filter{active > 1 ? "s" : ""} active
            </span>
            <button type="button" onClick={reset} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-navy underline-offset-2 active:underline">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Clear all
            </button>
          </div>
        )}

        {/* ── Desktop grid (unchanged layout) ── */}
        <div className="hidden grid-cols-1 gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-4">{fields.map((f, i) => renderField(f, i, false))}</div>
        <div className="mt-3 hidden flex-wrap items-center justify-between gap-2 text-xs text-muted lg:flex">
          <span className="flex items-center gap-2">
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {active ? `${active} filter${active > 1 ? "s" : ""} active` : "No filters applied"}
          </span>
          <div className="flex items-center gap-2">
            {searchField && (
              <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-navy px-3 text-xs font-semibold text-white hover:bg-navy-dark">
                <Search className="h-3.5 w-3.5" /> Apply search
              </button>
            )}
            {active > 0 && (
              <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink hover:bg-surface">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>
        </div>
      </form>

      {/* ── Phone filter sheet ── */}
      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Filters"
        description={draftActive ? `${draftActive} filter${draftActive > 1 ? "s" : ""} selected` : "Narrow down the list"}
        height="auto"
        footer={
          <>
            <Button type="button" variant="outline" fullWidth onClick={reset} leftIcon={<RotateCcw className="h-4 w-4" />}>
              Reset
            </Button>
            <Button type="button" variant="navy" fullWidth onClick={showResults}>
              Show results
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">{sheetFields.map((f, i) => renderField(f, i, true))}</div>
      </BottomSheet>
    </>
  );
}
