"use client";

import * as React from "react";
import { Loader2, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
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
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * THE admin filter bar. One engine, two call styles.
 *
 * The audit found two FilterBars with different search semantics — one applied on a 400ms debounce
 * with no way to clear the field, the other only on Enter and offered an "Apply search" button. Both
 * now run on the engine in this file, so there is ONE documented behaviour:
 *
 *   SEARCH   type freely; the query is applied 400ms after you stop typing, immediately on Enter, and
 *            immediately when you press the × that appears in the field. Applying while you type uses
 *            router.replace, so Back returns to the previous page rather than the previous keystroke,
 *            and a spinner in the field says the server is still working — on a 2G connection that
 *            feedback is the whole difference between "loading" and "broken".
 *   FILTERS  a select applies the moment it changes. Any other named control (a raw input a page
 *            renders itself) applies when the form is submitted.
 *   RESET    clears every filter; keys listed in `preserve` (the active tab, usually) survive.
 *   PHONE    below `lg` the bar is a sticky toolbar under the app bar: the search field plus a
 *            "Filters (n)" button opening a BottomSheet with every other control stacked full width.
 *            Sheet edits are a DRAFT — one navigation happens on "Show results", not one per tap.
 *
 * Controls inside the sheet read and write the draft through FilterDraftContext, which is a single
 * shared map rather than per-control state. That is what lets a dependent control (a Batch select that
 * depends on the chosen Centre) see the sibling value the user just picked, and it is why the old
 * hidden-input trick for clearing a stale districtId is gone.
 *
 * No backdrop-blur on the sticky toolbar: a blurred ancestor becomes the containing block for every
 * position:fixed descendant (this is what clamped the mobile menu and lost the admin FAB), and blur on
 * a surface that scrolls costs real battery on the cheap Android phones our staff use in the field.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Sticks the toolbar right below the 56px mobile app bar (pt-safe included). */
const STICKY_TOP = "top-[calc(3.5rem+env(safe-area-inset-top,0px))]";

/** How long after the last keystroke the search is applied. */
export const SEARCH_DEBOUNCE_MS = 400;

interface DraftStore {
  values: Record<string, string>;
  set: (values: Record<string, string | undefined>) => void;
}

/** Present only inside the mobile filter sheet: controls write a draft and one navigation happens on Apply. */
const FilterDraftContext = React.createContext<DraftStore | null>(null);

/** `true` while the router is navigating because of a filter change. */
const FilterPendingContext = React.createContext(false);

/**
 * Read and write one filter key. Inside the sheet this is the shared draft; outside it is the URL.
 * `commitNow` always goes straight to the URL, whichever side you are on.
 */
export function useFilterField() {
  const { get: urlGet, set: urlSet } = useUrlParams();
  const draft = React.useContext(FilterDraftContext);
  const pending = React.useContext(FilterPendingContext);
  const inSheet = draft !== null;

  const get = React.useCallback((key: string) => (draft && key in draft.values ? draft.values[key]! : urlGet(key)), [draft, urlGet]);
  const set = React.useCallback(
    (values: Record<string, string | undefined>) => {
      if (draft) draft.set(values);
      else urlSet(values);
    },
    [draft, urlSet]
  );

  return { inSheet, pending, get, set, commitNow: urlSet };
}

/** One label treatment for every filter control, at both sizes. Never below 12px. */
export function FilterLabel({ htmlFor, children, as = "label" }: { htmlFor?: string; children: React.ReactNode; as?: "label" | "span" }) {
  const className = "mb-1.5 block text-caption font-semibold tracking-wide text-muted uppercase";
  if (as === "span") return <span className={className}>{children}</span>;
  return (
    <label className={className} htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function isSearchElement(node: React.ReactNode): boolean {
  return React.isValidElement(node) && node.type === SearchInput;
}

export interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
  showReset?: boolean;
  /**
   * The control shown next to the "Filters" button on phones. Defaults to the SearchInput found among
   * `children`; pass it explicitly when the search field is rendered by a wrapper component.
   */
  search?: React.ReactNode;
  /** Title of the mobile filter sheet. Default "Filters". */
  sheetTitle?: string;
  /** Query keys that must survive Reset — the active tab, a locked status, and so on. */
  preserve?: string[];
}

export function FilterBar({ children, className, showReset = true, search, sheetTitle = "Filters", preserve = [] }: FilterBarProps) {
  const { set, reset, pending, searchParams } = useUrlParams();
  const isDesktop = useIsDesktop();
  const [open, setOpen] = React.useState(false);
  const [draftValues, setDraftValues] = React.useState<Record<string, string>>({});
  const sheetFormId = React.useId();

  // Split the search field out of the children so it can live in the phone toolbar.
  const items = React.Children.toArray(children);
  const detected = search ?? items.find(isSearchElement);
  const rest = search ? items : items.filter((c) => c !== detected);

  // Active filters = every query param except paging and the preserved keys.
  const skip = new Set(["page", "limit", ...preserve]);
  const activeCount = Array.from(searchParams.keys()).filter((k) => !skip.has(k) && (searchParams.get(k) ?? "") !== "").length;
  const hasFilters = activeCount > 0;

  const draft = React.useMemo<DraftStore>(
    () => ({
      values: draftValues,
      // "" is a real state here — "the user cleared this" — so it is stored, not dropped.
      set: (values) => setDraftValues((d) => ({ ...d, ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v ?? ""])) })),
    }),
    [draftValues]
  );

  /** Collects any raw named input a page rendered itself. Kit controls are handled by the draft. */
  const formValues = (form: HTMLFormElement) => {
    const out: Record<string, string | undefined> = {};
    new FormData(form).forEach((v, k) => {
      if (typeof v === "string") out[k] = v;
    });
    return out;
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    set(formValues(e.currentTarget));
  };

  const onSheetSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Draft wins over FormData: a select the user changed in the sheet is authoritative.
    set({ ...formValues(e.currentTarget), ...draftValues });
    setDraftValues({});
    setOpen(false);
  };

  const clearAll = () => {
    setDraftValues({});
    reset(preserve);
    setOpen(false);
  };

  const openSheet = () => {
    setDraftValues({});
    setOpen(true);
  };
  const closeSheet = () => {
    setDraftValues({});
    setOpen(false);
  };

  return (
    <FilterPendingContext.Provider value={pending}>
      <form
        onSubmit={onSubmit}
        role="search"
        aria-label="Filters"
        className={cn(
          // Phones / tablets: a sticky one-line toolbar under the app bar, bleeding into the page gutter.
          // Opaque, never blurred — see the note at the top of this file.
          "sticky z-sticky mb-4 -mx-4 flex items-end gap-2 border-b border-line bg-surface px-4 py-2.5 sm:-mx-6 sm:px-6",
          STICKY_TOP,
          // lg+: the inline filter card.
          "lg:card lg:static lg:mx-0 lg:flex-wrap lg:gap-3 lg:bg-white lg:px-4 lg:py-4",
          className
        )}
      >
        {detected && <div className="min-w-0 flex-1 max-lg:[&>div]:min-w-0 lg:contents">{detected}</div>}
        {isDesktop ? (
          <>
            <div className="hidden lg:contents">{rest}</div>
            <div className="hidden items-center gap-2 self-end lg:flex">
              <Button type="submit" size="sm" variant="navy">
                Apply
              </Button>
              {showReset && hasFilters && (
                <Button type="button" size="sm" variant="ghost" onClick={() => reset(preserve)} leftIcon={<RotateCcw className="h-4 w-4" aria-hidden />}>
                  Reset
                </Button>
              )}
              <span aria-live="polite" className="text-body-sm text-muted">
                {pending ? "Updating…" : hasFilters ? `${activeCount} filter${activeCount === 1 ? "" : "s"} active` : ""}
              </span>
            </div>
          </>
        ) : (
          rest.length > 0 && (
            <Button
              type="button"
              size="md"
              variant="outline"
              onClick={openSheet}
              className={cn("shrink-0", !detected && "flex-1")}
              aria-haspopup="dialog"
              aria-expanded={open}
              leftIcon={pending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <SlidersHorizontal className="h-4 w-4" aria-hidden />}
            >
              {sheetTitle}
              {activeCount > 0 && (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1.5 text-caption font-bold text-white tabular-nums" aria-hidden>
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
          onClose={closeSheet}
          title={sheetTitle}
          description={activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} applied` : "Narrow down the list"}
          height="auto"
          size="md"
          footer={
            <>
              <Button type="button" variant="outline" size="md" onClick={clearAll} leftIcon={<RotateCcw className="h-4 w-4" aria-hidden />} fullWidth className="sm:w-auto">
                Clear all
              </Button>
              <Button type="submit" form={sheetFormId} variant="navy" size="md" fullWidth className="sm:w-auto">
                Show results
              </Button>
            </>
          }
        >
          <form id={sheetFormId} onSubmit={onSheetSubmit} aria-label="Filter options" className="grid gap-5 pb-2">
            <FilterDraftContext.Provider value={draft}>{rest}</FilterDraftContext.Provider>
          </form>
        </BottomSheet>
      )}
    </FilterPendingContext.Provider>
  );
}

/**
 * Free-text search bound to a query param (default `q`). See the behaviour note at the top of the file:
 * debounce, Enter, and a × that clears — one field, one rule, everywhere in admin.
 */
export function SearchInput({ name = "q", placeholder = "Search…", className, debounceMs = SEARCH_DEBOUNCE_MS, label = "Search" }: { name?: string; placeholder?: string; className?: string; debounceMs?: number; label?: string }) {
  const { get, set } = useUrlParams();
  const pending = React.useContext(FilterPendingContext);
  const initial = get(name);
  const [value, setValue] = React.useState(initial);
  const [syncedInitial, setSyncedInitial] = React.useState(initial);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Re-sync when the URL changes from outside (Reset, Back) – state adjustment during render, not an effect.
  if (syncedInitial !== initial) {
    setSyncedInitial(initial);
    setValue(initial);
  }

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const commit = (v: string, immediate: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    // `replace` while typing so the history is pages, not keystrokes.
    const run = () => set({ [name]: v.trim() || undefined }, { replace: true });
    if (immediate) run();
    else timer.current = setTimeout(run, debounceMs);
  };

  const id = `filter-${name}`;
  return (
    <div className={cn("min-w-[14rem] flex-1", className)}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        name={name}
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          commit(e.target.value, false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(e.currentTarget.value, true);
          }
        }}
        placeholder={placeholder}
        leftIcon={pending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
        rightIcon={
          value ? (
            <button
              type="button"
              aria-label="Clear search"
              className="touch-target -mr-1.5 inline-flex items-center justify-center rounded-md text-muted ring-focus tap-highlight-none transition-colors duration-micro hover:text-navy motion-reduce:transition-none"
              onClick={() => {
                setValue("");
                commit("", true);
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : undefined
        }
        autoComplete="off"
        inputMode="search"
        enterKeyHint="search"
      />
    </div>
  );
}

/** Select bound to a query param. Applies on change (on "Show results" inside the mobile sheet). */
export function SelectFilter({ name, label, options, placeholder = "All", className, disabled }: { name: string; label: string; options: SelectOption[]; placeholder?: string; className?: string; immediate?: boolean; disabled?: boolean }) {
  const { get, set, inSheet } = useFilterField();
  const id = `filter-${name}`;
  return (
    <div className={cn(inSheet ? "w-full min-w-0" : "min-w-[10rem]", className, inSheet && "min-w-0")}>
      <FilterLabel htmlFor={id}>{label}</FilterLabel>
      <Select id={id} name={name} value={get(name)} onChange={(e) => set({ [name]: e.target.value || undefined })} options={options} placeholder={placeholder} disabled={disabled} />
    </div>
  );
}

/** State / district / block filter bound to the stateId, districtId and blockId query params. */
export function LocationFilter({ depth = "block", className }: { depth?: "state" | "district" | "block"; className?: string }) {
  const { get, set, inSheet } = useFilterField();
  const value: LocationValue = { stateId: get("stateId") || undefined, districtId: get("districtId") || undefined, blockId: get("blockId") || undefined };
  return (
    <div className={cn(inSheet ? "w-full min-w-0" : "min-w-[10rem]", className, inSheet && "min-w-0")}>
      <FilterLabel as="span">Location</FilterLabel>
      <LocationCascade
        bare
        depth={depth}
        value={value}
        // All three keys are written together, so narrowing the state always clears a stale district.
        onChange={(v) => set({ stateId: v.stateId, districtId: v.districtId, blockId: v.blockId })}
        placeholderPrefix="All"
        className={inSheet ? "grid gap-3" : "flex flex-wrap gap-2 [&>div]:min-w-[10rem]"}
      />
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

/** Date range filter bound to the range, from and to query params (see dateRangeSchema). */
export function DateRangeFilter({ className, allLabel = "All time", defaultRange = "" }: { className?: string; allLabel?: string; defaultRange?: string }) {
  const { get, set, inSheet } = useFilterField();
  const range = get("range") || defaultRange;
  const from = get("from");
  const to = get("to");
  const custom = range === "custom";

  const periodSelect = (
    <div className={inSheet ? "min-w-0" : "min-w-[10rem]"}>
      <FilterLabel htmlFor="filter-range">Period</FilterLabel>
      <Select
        id="filter-range"
        name="range"
        value={range}
        onChange={(e) => {
          const v = e.target.value;
          // Leaving "custom" drops the dates with it, so the URL never carries a range nobody is using.
          if (v === "custom") set({ range: "custom" });
          else set({ range: v || undefined, from: undefined, to: undefined });
        }}
        options={RANGE_OPTIONS}
        placeholder={allLabel}
      />
    </div>
  );

  if (inSheet) {
    return (
      <div className={cn("w-full min-w-0 space-y-3", className)}>
        {periodSelect}
        {custom && <DateRangeInput from={from} to={to} onChange={(v) => set({ from: v.from || undefined, to: v.to || undefined })} max={new Date()} />}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)}>
      {periodSelect}
      {custom && (
        <>
          <div>
            <FilterLabel htmlFor="filter-from">From</FilterLabel>
            <Input id="filter-from" name="from" type="date" value={from} max={to || undefined} onChange={(e) => set({ from: e.target.value || undefined })} />
          </div>
          <div>
            <FilterLabel htmlFor="filter-to">To</FilterLabel>
            <Input id="filter-to" name="to" type="date" value={to} min={from || undefined} onChange={(e) => set({ to: e.target.value || undefined })} />
          </div>
        </>
      )}
    </div>
  );
}
