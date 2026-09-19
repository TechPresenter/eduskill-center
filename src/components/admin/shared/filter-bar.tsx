"use client";

import * as React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/lib/hooks";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { DateRangeInput } from "@/components/ui/date-input";
import { LocationCascade, type LocationValue } from "@/components/shared/location-cascade";
import { useUrlParams } from "./use-url-params";

/*
 * Mobile-first filters.
 *
 * Below `lg` the bar collapses to a sticky toolbar: the search field plus a 48px "Filters" button with a
 * count badge that opens a BottomSheet holding every other control stacked full width, with Apply / Clear.
 * From `lg` up the exact same inline card as before is rendered, so desktop is untouched.
 *
 * Nothing changes at the call sites: `<FilterBar><SearchInput/><SelectFilter…/></FilterBar>` keeps working.
 * Inside the sheet the controls switch to *draft* mode (they hold local state and one navigation happens on
 * Apply) instead of pushing the URL on every change, which would reload the page under the open sheet.
 */

/** `true` for controls rendered inside the mobile filter sheet (draft mode: apply on submit). */
const DraftContext = React.createContext(false);

/** Sticks the toolbar right below the 56px mobile app bar (`pt-safe` included). */
const STICKY_TOP = "top-[calc(3.5rem+env(safe-area-inset-top,0px))]";

function isSearchElement(node: React.ReactNode): boolean {
  return React.isValidElement(node) && node.type === SearchInput;
}

export interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
  showReset?: boolean;
  /**
   * The control shown next to the "Filters" button on phones. Defaults to the `<SearchInput>` found
   * among `children`; pass it explicitly when the search field is rendered by a wrapper component.
   */
  search?: React.ReactNode;
  /** Title of the mobile filter sheet. Default "Filters". */
  sheetTitle?: string;
}

/**
 * Wraps filter controls. Submitting pushes every named field into the query string
 * (empty values are removed, `page` is reset). Reset clears all filters.
 */
export function FilterBar({ children, className, showReset = true, search, sheetTitle = "Filters" }: FilterBarProps) {
  const { set, reset, searchParams } = useUrlParams();
  const isDesktop = useIsDesktop();
  const [open, setOpen] = React.useState(false);
  const sheetFormId = React.useId();

  // Split the search field out of the children so it can live in the phone toolbar.
  const items = React.Children.toArray(children);
  const detected = search ?? items.find(isSearchElement);
  const rest = search ? items : items.filter((c) => c !== detected);

  // Active filters = every query param except paging (used for the count badge and the Reset button).
  const activeKeys = new Set(Array.from(searchParams.keys()).filter((k) => k !== "page" && (searchParams.get(k) ?? "") !== ""));
  const activeCount = activeKeys.size;
  const hasFilters = activeCount > 0;

  const apply = (form: HTMLFormElement) => {
    const values: Record<string, string | undefined> = {};
    new FormData(form).forEach((v, k) => {
      values[k] = typeof v === "string" ? v : undefined;
    });
    set(values);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    apply(e.currentTarget);
  };

  const onSheetSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    apply(e.currentTarget);
    setOpen(false);
  };

  const clearAll = () => {
    reset();
    setOpen(false);
  };

  return (
    <>
      <form
        onSubmit={onSubmit}
        role="search"
        aria-label="Filters"
        className={cn(
          // Phones / tablets: sticky one-line toolbar under the app bar, bleeding into the page gutter.
          "sticky z-20 mb-4 -mx-4 flex items-end gap-2 bg-surface/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6",
          STICKY_TOP,
          // lg+: the original inline filter card, unchanged.
          "lg:card lg:static lg:mx-0 lg:flex-wrap lg:gap-3 lg:bg-white lg:px-4 lg:py-4 lg:backdrop-blur-none",
          className
        )}
      >
        {detected && <div className="min-w-0 flex-1 max-lg:[&>div]:min-w-0 lg:contents">{detected}</div>}
        {isDesktop ? (
          <>
            <div className="hidden lg:contents">{rest}</div>
            <div className="hidden items-center gap-2 lg:flex">
              <Button type="submit" size="sm" variant="navy">
                Apply
              </Button>
              {showReset && hasFilters && (
                <Button type="button" size="sm" variant="ghost" onClick={reset} leftIcon={<X className="h-4 w-4" />}>
                  Reset
                </Button>
              )}
            </div>
          </>
        ) : (
          rest.length > 0 && (
            <Button
              type="button"
              size="md"
              variant="outline"
              onClick={() => setOpen(true)}
              className={cn("shrink-0", !detected && "flex-1")}
              aria-haspopup="dialog"
              aria-expanded={open}
              leftIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
            >
              {sheetTitle}
              {activeCount > 0 && (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1.5 text-[11px] font-bold text-white tabular-nums" aria-hidden>
                  {activeCount}
                </span>
              )}
              <span className="sr-only">{activeCount > 0 ? `, ${activeCount} active` : ""}</span>
            </Button>
          )
        )}
      </form>

      {!isDesktop && rest.length > 0 && (
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title={sheetTitle}
          description={activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} applied` : "Narrow down the list"}
          height="auto"
          size="md"
          footer={
            <>
              <Button type="button" variant="ghost" size="md" onClick={clearAll} leftIcon={<X className="h-4 w-4" />} fullWidth className="sm:w-auto">
                Clear all
              </Button>
              <Button type="submit" form={sheetFormId} variant="primary" size="md" fullWidth className="sm:w-auto">
                Apply filters
              </Button>
            </>
          }
        >
          <form id={sheetFormId} onSubmit={onSheetSubmit} aria-label="Filter options" className="grid gap-4 pb-2">
            <DraftContext.Provider value>{rest}</DraftContext.Provider>
          </form>
        </BottomSheet>
      )}
    </>
  );
}

/**
 * Reads a filter param. In the mobile sheet (or with `immediate={false}`) the value is kept locally and
 * applied when the sheet's Apply button submits the form; otherwise every change pushes the URL.
 */
function useFilterValue(name: string, immediate = true) {
  const inSheet = React.useContext(DraftContext);
  const draft = inSheet || !immediate;
  const { get, set } = useUrlParams();
  const urlValue = get(name);
  const [local, setLocal] = React.useState(urlValue);
  const [synced, setSynced] = React.useState(urlValue);
  // Re-sync when the URL changes from outside (Reset, another control) – during render, not in an effect.
  if (synced !== urlValue) {
    setSynced(urlValue);
    setLocal(urlValue);
  }
  const commit = (v: string) => (draft ? setLocal(v) : set({ [name]: v || undefined }));
  return { draft, inSheet, value: draft ? local : urlValue, commit };
}

/** Debounced free-text search bound to a query param (default `q`). */
export function SearchInput({ name = "q", placeholder = "Search…", className, debounceMs = 400 }: { name?: string; placeholder?: string; className?: string; debounceMs?: number }) {
  const { get, set } = useUrlParams();
  const initial = get(name);
  const [value, setValue] = React.useState(initial);
  const [syncedInitial, setSyncedInitial] = React.useState(initial);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Re-sync when the URL changes from outside (e.g. Reset) – state adjustment during render, not in an effect.
  if (syncedInitial !== initial) {
    setSyncedInitial(initial);
    setValue(initial);
  }
  const onChange = (v: string) => {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => set({ [name]: v.trim() || undefined }, { replace: true }), debounceMs);
  };
  return (
    <div className={cn("min-w-[14rem] flex-1", className)}>
      <label className="sr-only" htmlFor={`filter-${name}`}>
        Search
      </label>
      <Input
        id={`filter-${name}`}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        leftIcon={<Search className="h-4 w-4" />}
        autoComplete="off"
        enterKeyHint="search"
      />
    </div>
  );
}

/** Select bound to a query param. Updates the URL immediately on change (on Apply inside the mobile sheet). */
export function SelectFilter({ name, label, options, placeholder = "All", className, immediate = true }: { name: string; label: string; options: SelectOption[]; placeholder?: string; className?: string; immediate?: boolean }) {
  const { value, commit, inSheet } = useFilterValue(name, immediate);
  return (
    <div className={cn(inSheet ? "w-full min-w-0" : "min-w-[10rem]", className, inSheet && "min-w-0")}>
      <label className={cn("mb-1 block font-medium text-muted", inSheet ? "text-[13px]" : "text-xs")} htmlFor={`filter-${name}`}>
        {label}
      </label>
      <Select id={`filter-${name}`} name={name} value={value} onChange={(e) => commit(e.target.value)} options={options} placeholder={placeholder} />
    </div>
  );
}

/** State / district / block filter bound to `stateId`, `districtId`, `blockId` query params. */
export function LocationFilter({ depth = "block", className }: { depth?: "state" | "district" | "block"; className?: string }) {
  const inSheet = React.useContext(DraftContext);
  const { get, set } = useUrlParams();
  const urlValue: LocationValue = { stateId: get("stateId") || undefined, districtId: get("districtId") || undefined, blockId: get("blockId") || undefined };
  const urlKey = `${urlValue.stateId ?? ""}|${urlValue.districtId ?? ""}|${urlValue.blockId ?? ""}`;
  const [local, setLocal] = React.useState(urlValue);
  const [synced, setSynced] = React.useState(urlKey);
  if (synced !== urlKey) {
    setSynced(urlKey);
    setLocal(urlValue);
  }
  const value = inSheet ? local : urlValue;
  const onChange = (v: LocationValue) => (inSheet ? setLocal(v) : set({ stateId: v.stateId, districtId: v.districtId, blockId: v.blockId }));

  // Disabled / not-rendered selects are left out of FormData, so the sheet submits them as empty
  // hidden fields instead – otherwise a stale districtId/blockId could never be cleared.
  const submittable = new Set(["stateId"]);
  if (depth !== "state" && value.stateId) submittable.add("districtId");
  if (depth === "block" && value.districtId) submittable.add("blockId");
  const hiddenNames = ["districtId", "blockId"].filter((n) => !submittable.has(n));

  return (
    <div className={cn(inSheet ? "w-full min-w-0" : "min-w-[10rem]", className, inSheet && "min-w-0")}>
      <span className={cn("mb-1 block font-medium text-muted", inSheet ? "text-[13px]" : "text-xs")}>Location</span>
      <LocationCascade
        bare
        depth={depth}
        value={value}
        onChange={onChange}
        placeholderPrefix="All"
        className={inSheet ? "grid gap-3" : "flex flex-wrap gap-2 [&>div]:min-w-[10rem]"}
      />
      {inSheet && hiddenNames.map((n) => <input key={n} type="hidden" name={n} value="" />)}
    </div>
  );
}

const RANGE_OPTIONS: SelectOption[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "custom", label: "Custom range" },
];

/** Date range filter bound to `range`, `from`, `to` query params (see dateRangeSchema). */
export function DateRangeFilter({ className, allLabel = "All time", defaultRange = "" }: { className?: string; allLabel?: string; defaultRange?: string }) {
  const inSheet = React.useContext(DraftContext);
  const { get, set } = useUrlParams();
  const urlRange = get("range");
  const urlFrom = get("from");
  const urlTo = get("to");
  const [range, setRange] = React.useState(urlRange || defaultRange);
  const [from, setFrom] = React.useState(urlFrom);
  const [to, setTo] = React.useState(urlTo);
  const [synced, setSynced] = React.useState(`${urlRange}|${urlFrom}|${urlTo}`);
  // Re-sync when the URL changes from outside – state adjustment during render, not in an effect.
  if (synced !== `${urlRange}|${urlFrom}|${urlTo}`) {
    setSynced(`${urlRange}|${urlFrom}|${urlTo}`);
    setRange(urlRange || defaultRange);
    setFrom(urlFrom);
    setTo(urlTo);
  }
  const effectiveRange = inSheet ? range : urlRange || defaultRange;
  const custom = effectiveRange === "custom";
  const applyCustom = (f: string, t: string) => set({ range: "custom", from: f || undefined, to: t || undefined });

  const periodSelect = (
    <div className={inSheet ? "min-w-0" : "min-w-[10rem]"}>
      <label className={cn("mb-1 block font-medium text-muted", inSheet ? "text-[13px]" : "text-xs")} htmlFor="filter-range">
        Period
      </label>
      <Select
        id="filter-range"
        name="range"
        value={effectiveRange}
        onChange={(e) => {
          const v = e.target.value;
          if (inSheet) {
            setRange(v);
            return;
          }
          if (v === "custom") applyCustom(from, to);
          else set({ range: v || undefined, from: undefined, to: undefined });
        }}
        options={RANGE_OPTIONS}
        placeholder={allLabel}
      />
    </div>
  );

  // Inside the sheet: one stacked block using the shared DateRangeInput, applied with the rest on submit.
  if (inSheet) {
    return (
      <div className={cn("w-full min-w-0 space-y-3", className)}>
        {periodSelect}
        {custom ? (
          <DateRangeInput from={from} to={to} onChange={(v) => { setFrom(v.from); setTo(v.to); }} max={new Date()} />
        ) : (
          <>
            <input type="hidden" name="from" value="" />
            <input type="hidden" name="to" value="" />
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)}>
      {periodSelect}
      {custom && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted" htmlFor="filter-from">
              From
            </label>
            <Input id="filter-from" name="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} onBlur={() => applyCustom(from, to)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted" htmlFor="filter-to">
              To
            </label>
            <Input id="filter-to" name="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} onBlur={() => applyCustom(from, to)} />
          </div>
        </>
      )}
    </div>
  );
}
