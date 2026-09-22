"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { LocationCascade, type LocationValue } from "@/components/shared/location-cascade";
import { CourseSelect, useCourseOptions } from "@/components/site/course-select";
import { buildQuery, cn } from "@/lib/utils";
import { withBasePath } from "@/lib/base-path";

export interface CenterSearchValues {
  stateId?: string;
  districtId?: string;
  blockId?: string;
  courseId?: string;
  q?: string;
  view?: string;
}

/**
 * Polish for every native control in the form, applied from the form element because
 * `LocationCascade` renders its three selects itself and takes no per-select class.
 * A wider focus halo and a live hover border; disabled selects stay quiet.
 */
const CONTROLS = "[&_input:not(:disabled):hover]:border-navy/40 [&_select:not(:disabled):hover]:border-navy/40 [&_input:focus]:ring-4 [&_select:focus]:ring-4";

type FilterKey = "stateId" | "districtId" | "blockId" | "courseId" | "q";

/**
 * Search form for training centers. Submits as a normal GET to /training-centers so it works
 * without JavaScript; with JS it pushes a clean URL (empty params dropped).
 *
 * Two shapes, same query parameters:
 *   `compact`  – the five inline controls used inside the home page card.
 *   default    – the full panel on /training-centers. Phones get an app-style search row: the
 *                keyword field inline, one "Filters" button (with a count badge) that opens a
 *                bottom sheet holding the four dropdowns, and an icon submit. From `md` up the
 *                dropdowns sit inline above the keyword row. The filters that are actually applied
 *                are listed underneath as dismissible chips at every width.
 */
export function CenterSearchForm({ initial = {}, compact, className, submitLabel = "Search Centers" }: { initial?: CenterSearchValues; compact?: boolean; className?: string; submitLabel?: string }) {
  const router = useRouter();
  const [loc, setLoc] = React.useState<LocationValue>({ stateId: initial.stateId, districtId: initial.districtId, blockId: initial.blockId });
  const [courseId, setCourseId] = React.useState(initial.courseId ?? "");
  const [q, setQ] = React.useState(initial.q ?? "");
  // `busy` stays true until the navigation (and the server re-render of the results) completes.
  const [busy, startTransition] = React.useTransition();

  const appliedCount = (initial.stateId ? 1 : 0) + (initial.districtId ? 1 : 0) + (initial.blockId ? 1 : 0) + (initial.courseId ? 1 : 0) + (initial.q ? 1 : 0);
  // Phones: the dropdowns live in a bottom sheet. What is filtering the results is never hidden —
  // the applied filters are listed as chips under the search row.
  const [sheetOpen, setSheetOpen] = React.useState(false);

  /** Names for ids we have seen, so a chip can say "Karnataka" and not a uuid. */
  const [nameById, setNameById] = React.useState<Record<string, string>>({});
  const courses = useCourseOptions();

  // Keep the controls in step with the URL after a chip dismissal, a back/forward navigation or a
  // link into the page with different params.
  const appliedKey = `${initial.stateId ?? ""}|${initial.districtId ?? ""}|${initial.blockId ?? ""}|${initial.courseId ?? ""}|${initial.q ?? ""}`;
  const lastApplied = React.useRef(appliedKey);
  React.useEffect(() => {
    if (lastApplied.current === appliedKey) return;
    lastApplied.current = appliedKey;
    const [stateId, districtId, blockId, course, keyword] = appliedKey.split("|");
    setLoc({ stateId: stateId || undefined, districtId: districtId || undefined, blockId: blockId || undefined });
    setCourseId(course ?? "");
    setQ(keyword ?? "");
  }, [appliedKey]);

  const push = (next: Record<FilterKey, string | undefined>) => {
    startTransition(() => {
      router.push(`/training-centers${buildQuery({ stateId: next.stateId, districtId: next.districtId, blockId: next.blockId, courseId: next.courseId, q: next.q?.trim(), view: initial.view })}`);
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    push({ stateId: loc.stateId, districtId: loc.districtId, blockId: loc.blockId, courseId, q });
  };

  /** Re-apply the currently APPLIED filters minus the dismissed one (cascading down the location tree). */
  const removeFilter = (key: FilterKey) => {
    const next: Record<FilterKey, string | undefined> = { stateId: initial.stateId, districtId: initial.districtId, blockId: initial.blockId, courseId: initial.courseId, q: initial.q };
    if (key === "stateId") next.stateId = next.districtId = next.blockId = undefined;
    else if (key === "districtId") next.districtId = next.blockId = undefined;
    else next[key] = undefined;
    setLoc({ stateId: next.stateId, districtId: next.districtId, blockId: next.blockId });
    setCourseId(next.courseId ?? "");
    setQ(next.q ?? "");
    push(next);
  };

  const clearAll = () => {
    setLoc({});
    setCourseId("");
    setQ("");
    push({ stateId: undefined, districtId: undefined, blockId: undefined, courseId: undefined, q: undefined });
  };

  // LocationCascade reports the display names of the CURRENT selection; remember them by id so a
  // chip for an applied filter can still be labelled after the selection has moved on.
  const rememberNames = (names: { state?: string; district?: string; block?: string }) => {
    setNameById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, name] of [
        [loc.stateId, names.state],
        [loc.districtId, names.district],
        [loc.blockId, names.block],
      ] as const) {
        if (id && name && next[id] !== name) {
          next[id] = name;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name;
  const chips: { key: FilterKey; label: string }[] = [];
  if (initial.stateId && nameById[initial.stateId]) chips.push({ key: "stateId", label: nameById[initial.stateId] });
  if (initial.districtId && nameById[initial.districtId]) chips.push({ key: "districtId", label: nameById[initial.districtId] });
  if (initial.blockId && nameById[initial.blockId]) chips.push({ key: "blockId", label: nameById[initial.blockId] });
  if (initial.courseId && courseName(initial.courseId)) chips.push({ key: "courseId", label: courseName(initial.courseId)! });
  if (initial.q) chips.push({ key: "q", label: `“${initial.q}”` });

  const pendingCount = (loc.stateId ? 1 : 0) + (loc.districtId ? 1 : 0) + (loc.blockId ? 1 : 0) + (courseId ? 1 : 0);

  const dropdowns = (
    <>
      <LocationCascade value={loc} onChange={setLoc} onNames={rememberNames} withCenters bare className="contents" />
      <CourseSelect value={courseId} onChange={setCourseId} placeholder="Any course" />
    </>
  );

  if (compact) {
    return (
      <form action={withBasePath("/training-centers")} method="get" onSubmit={submit} role="search" aria-label="Search training centers" className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-5", CONTROLS, className)}>
        {initial.view && <input type="hidden" name="view" value={initial.view} />}
        {dropdowns}
        <Button type="submit" size="md" loading={busy} leftIcon={<Search className="h-4 w-4" />} className="lg:col-span-1">
          {submitLabel}
        </Button>
      </form>
    );
  }

  /** Apply from the sheet: same as a submit, then close it. */
  const applyFromSheet = () => {
    setSheetOpen(false);
    push({ stateId: loc.stateId, districtId: loc.districtId, blockId: loc.blockId, courseId, q });
  };

  const resetSheet = () => {
    setLoc({});
    setCourseId("");
  };

  return (
    <form action={withBasePath("/training-centers")} method="get" onSubmit={submit} role="search" aria-label="Search training centers" aria-busy={busy} className={cn("grid gap-3", CONTROLS, className)}>
      {initial.view && <input type="hidden" name="view" value={initial.view} />}

      {/*
        From md up the four dropdowns sit inline. Below md this block is CSS-hidden (no flash, no
        media-query JS) and the sheet renders its own copy. It stays mounted on phones on purpose: it
        reports the names the "Applied" chips need, and LocationCascade caches its option lists per
        module, so the second copy in the sheet costs no extra request. Both are controlled by the
        same state.
      */}
      <div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-4">{dropdowns}</div>

      <div className="flex gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <Input
            name="q"
            type="search"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, code or PIN"
            aria-label="Center name, code or PIN code"
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>

        {/* Phones: the one Filters button that opens the sheet. */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-label={pendingCount > 0 ? `Filters, ${pendingCount} selected` : "Filters"}
          className="relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-navy tap-highlight-none transition-colors duration-micro active:bg-surface ring-focus motion-reduce:transition-none md:hidden"
        >
          <SlidersHorizontal className="h-4 w-4 text-orange" aria-hidden />
          <span className="max-[359px]:sr-only">Filters</span>
          {pendingCount > 0 && <span aria-hidden className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1.5 text-caption font-bold text-white tabular-nums">{pendingCount}</span>}
        </button>

        {/* From sm up. On a phone the row is field + Filters, like any app search bar: the keyboard's
            search key (enterKeyHint) submits the field and the sheet has its own "Show centres". */}
        <Button type="submit" size="md" loading={busy} leftIcon={<Search className="h-4 w-4" />} className="hidden shrink-0 sm:inline-flex sm:min-w-44 hover:shadow-md">
          {submitLabel}
        </Button>
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter centres"
        description="Narrow the list by location and course."
        bodyClassName={cn("grid gap-3 px-5 py-4", CONTROLS)}
        footer={
          <>
            <Button type="button" variant="outline" onClick={resetSheet} disabled={pendingCount === 0}>
              Reset
            </Button>
            <Button type="button" onClick={applyFromSheet} loading={busy} leftIcon={<Search className="h-4 w-4" />}>
              Show centres
            </Button>
          </>
        }
      >
        {dropdowns}
      </BottomSheet>

      {appliedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
          <span className="text-xs font-bold tracking-wider text-muted uppercase">Applied</span>
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => removeFilter(c.key)}
              aria-label={`Remove filter ${c.label}`}
              className="group inline-flex min-h-11 animate-pop items-center gap-1.5 rounded-full bg-lavender py-1 pr-2 pl-3 text-[13px] font-semibold text-navy transition-colors duration-micro hover:bg-navy hover:text-white focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:outline-none motion-reduce:animate-none motion-reduce:transition-none sm:min-h-8"
            >
              <span className="max-w-[11rem] truncate">{c.label}</span>
              <X className="h-3.5 w-3.5 shrink-0 opacity-60 transition-opacity duration-micro group-hover:opacity-100 motion-reduce:transition-none" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-orange underline-offset-4 transition-colors duration-micro hover:text-orange-hover hover:underline focus-visible:ring-2 focus-visible:ring-orange/30 focus-visible:outline-none motion-reduce:transition-none sm:min-h-8"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear all
          </button>
        </div>
      )}
    </form>
  );
}
