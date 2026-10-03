"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { inputClasses } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface LocationValue {
  stateId?: string;
  districtId?: string;
  /** Set when the block was picked from (or typed exactly as) an existing block of the district. */
  blockId?: string;
  /** The block as typed. Forms send it with blockId; the server finds or adds the block (resolveBlockId). */
  blockName?: string;
}

export interface LocationOption {
  id: string;
  name: string;
}

interface LocationCascadeProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  /** Deepest level to show. */
  depth?: "state" | "district" | "block";
  required?: boolean;
  errors?: { stateId?: string; districtId?: string; blockId?: string; blockName?: string };
  /** Only offer locations with active training centers (public center search). */
  withCenters?: boolean;
  /**
   * How the block is entered. "type" (default for forms): a text box with the district's blocks as
   * suggestions, so a block that is not in the list yet can still be written. "select" (default for
   * filters — `bare` or `withCenters`): a dropdown of existing blocks only.
   */
  blockMode?: "select" | "type";
  labels?: { state?: string; district?: string; block?: string };
  placeholderPrefix?: string;
  /**
   * One-word placeholders ("State", "District", "Block") for narrow inline rows such as the public
   * centre search, where "Select state first" would be cut to "Select sta".
   */
  shortPlaceholders?: boolean;
  disabled?: boolean;
  /**
   * Render selects without <Field> labels (compact inline usage). Defaults to a responsive grid
   * (`grid gap-3 sm:grid-cols-3`, fewer columns for shallower depths); an explicit `className` replaces it.
   */
  bare?: boolean;
  className?: string;
  /** Called with the display names whenever they change (useful for summaries). */
  onNames?: (names: { state?: string; district?: string; block?: string }) => void;
}

const cache = new Map<string, Promise<LocationOption[]>>();

function load(kind: "states" | "districts" | "blocks", parentId: string | undefined, withCenters: boolean): Promise<LocationOption[]> {
  const key = `${kind}:${parentId ?? ""}:${withCenters}`;
  if (!cache.has(key)) {
    const params = new URLSearchParams();
    if (kind === "districts" && parentId) params.set("stateId", parentId);
    if (kind === "blocks" && parentId) params.set("districtId", parentId);
    if (withCenters) params.set("withCenters", "true");
    const p = api
      .get<Record<string, LocationOption[]>>(`/api/public/locations?${params.toString()}`)
      .then((d) => d[kind] ?? [])
      .catch(() => {
        cache.delete(key);
        return [];
      });
    cache.set(key, p);
  }
  return cache.get(key)!;
}

/**
 * State → District → Block cascading selects backed by the database (never hard-coded).
 * Use `depth` to stop at state or district (e.g. trainer volunteer levels).
 */
export function LocationCascade({ value, onChange, depth = "block", required, errors, withCenters = false, blockMode, labels, placeholderPrefix = "Select", shortPlaceholders, disabled, bare, className, onNames }: LocationCascadeProps) {
  const typeBlock = (blockMode ?? (bare || withCenters ? "select" : "type")) === "type";
  const blockError = errors?.blockId ?? errors?.blockName;
  const [states, setStates] = React.useState<LocationOption[]>([]);
  // Child lists are stored together with the parent id they belong to, so stale lists are
  // never shown and "loading" is derived instead of set synchronously inside effects.
  const [districtState, setDistrictState] = React.useState<{ forId: string | undefined; items: LocationOption[] }>({ forId: undefined, items: [] });
  const [blockState, setBlockState] = React.useState<{ forId: string | undefined; items: LocationOption[] }>({ forId: undefined, items: [] });

  const wantDistricts = depth !== "state" && !!value.stateId;
  const wantBlocks = depth === "block" && !!value.districtId;
  const districts = wantDistricts && districtState.forId === value.stateId ? districtState.items : [];
  const blocks = wantBlocks && blockState.forId === value.districtId ? blockState.items : [];
  const loading = { d: wantDistricts && districtState.forId !== value.stateId, b: wantBlocks && blockState.forId !== value.districtId };

  React.useEffect(() => {
    let active = true;
    void load("states", undefined, withCenters).then((s) => active && setStates(s));
    return () => {
      active = false;
    };
  }, [withCenters]);

  React.useEffect(() => {
    if (!wantDistricts) return;
    const id = value.stateId;
    let active = true;
    void load("districts", id, withCenters).then((items) => active && setDistrictState({ forId: id, items }));
    return () => {
      active = false;
    };
  }, [wantDistricts, value.stateId, withCenters]);

  React.useEffect(() => {
    if (!wantBlocks) return;
    const id = value.districtId;
    let active = true;
    void load("blocks", id, withCenters).then((items) => active && setBlockState({ forId: id, items }));
    return () => {
      active = false;
    };
  }, [wantBlocks, value.districtId, withCenters]);

  React.useEffect(() => {
    if (!onNames) return;
    onNames({
      state: states.find((s) => s.id === value.stateId)?.name,
      district: districts.find((d) => d.id === value.districtId)?.name,
      block: blocks.find((b) => b.id === value.blockId)?.name ?? (value.blockName?.trim() || undefined),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.stateId, value.districtId, value.blockId, value.blockName, states, districts, blocks]);

  const stateSelect = (
    <Select
      name="stateId"
      value={value.stateId ?? ""}
      onChange={(e) => onChange({ stateId: e.target.value || undefined, districtId: undefined, blockId: undefined, blockName: undefined })}
      options={states.map((s) => ({ value: s.id, label: s.name }))}
      placeholder={shortPlaceholders ? "State" : `${placeholderPrefix} state`}
      required={required}
      disabled={disabled}
      invalid={!!errors?.stateId}
      aria-label={labels?.state ?? "State"}
    />
  );
  const districtSelect = (
    <Select
      name="districtId"
      value={value.districtId ?? ""}
      onChange={(e) => onChange({ stateId: value.stateId, districtId: e.target.value || undefined, blockId: undefined, blockName: undefined })}
      options={districts.map((d) => ({ value: d.id, label: d.name }))}
      placeholder={loading.d ? "Loading…" : shortPlaceholders ? "District" : value.stateId ? `${placeholderPrefix} district` : "Select state first"}
      // The placeholder says "Loading…" visually; aria-busy says the same thing to a screen reader.
      aria-busy={loading.d || undefined}
      required={required}
      disabled={disabled || !value.stateId}
      invalid={!!errors?.districtId}
      aria-label={labels?.district ?? "District"}
    />
  );
  const blockSelect = typeBlock ? (
    <BlockInput
      blocks={blocks}
      loading={loading.b}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled || !value.districtId}
      invalid={!!blockError}
      ariaLabel={labels?.block ?? "Block"}
    />
  ) : (
    <Select
      name="blockId"
      value={value.blockId ?? ""}
      onChange={(e) => onChange({ ...value, blockId: e.target.value || undefined, blockName: undefined })}
      options={blocks.map((b) => ({ value: b.id, label: b.name }))}
      placeholder={loading.b ? "Loading…" : shortPlaceholders ? "Block" : value.districtId ? `${placeholderPrefix} block` : "Select district first"}
      aria-busy={loading.b || undefined}
      required={required}
      disabled={disabled || !value.districtId}
      invalid={!!blockError}
      aria-label={labels?.block ?? "Block"}
    />
  );

  if (bare) {
    // Stack on phones, one row from sm up, so inline filter usage never collapses; callers override via className.
    const bareClass = className ?? cn("grid gap-3", depth === "block" && "sm:grid-cols-3", depth === "district" && "sm:grid-cols-2");
    return (
      <div className={bareClass}>
        {stateSelect}
        {depth !== "state" && districtSelect}
        {depth === "block" && blockSelect}
      </div>
    );
  }

  return (
    // Same contract as `bare`: an explicit `className` replaces the default, otherwise the three
    // labelled fields get the standard stack gap. Without this they sat flush against each other
    // wherever a caller passed no className at all.
    <div className={className ?? "space-y-4"}>
      <Field label={labels?.state ?? "State"} required={required} error={errors?.stateId}>
        {stateSelect}
      </Field>
      {depth !== "state" && (
        <Field label={labels?.district ?? "District"} required={required} error={errors?.districtId}>
          {districtSelect}
        </Field>
      )}
      {depth === "block" && (
        <Field label={labels?.block ?? "Block"} required={required} error={blockError}>
          {blockSelect}
        </Field>
      )}
    </div>
  );
}

/**
 * The typable block box: the district's blocks as suggestions, and any name accepted. Picking a
 * suggestion — or typing one exactly — sets `blockId`; anything else travels as `blockName` and
 * the server adds it to the district. One input, keyboard-driven (arrows, Enter, Escape).
 */
function BlockInput({
  blocks,
  loading,
  value,
  onChange,
  required,
  disabled,
  invalid,
  ariaLabel,
}: {
  blocks: LocationOption[];
  loading: boolean;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel: string;
}) {
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const text = value.blockName ?? blocks.find((b) => b.id === value.blockId)?.name ?? "";
  const needle = text.trim().toLowerCase();
  const exact = needle ? blocks.find((b) => b.name.toLowerCase() === needle) : undefined;
  const options = (needle ? blocks.filter((b) => b.name.toLowerCase().includes(needle) && b !== exact) : blocks).slice(0, 8);
  const showList = open && !disabled && options.length > 0;
  const activeIndex = options.length ? Math.min(active, options.length - 1) : 0;

  const set = (name: string) => {
    const match = blocks.find((b) => b.name.toLowerCase() === name.trim().toLowerCase());
    onChange({ ...value, blockId: match?.id, blockName: name });
  };
  const pick = (o: LocationOption) => {
    onChange({ ...value, blockId: o.id, blockName: o.name });
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        name="blockName"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        aria-invalid={invalid || undefined}
        aria-busy={loading || undefined}
        autoComplete="off"
        maxLength={80}
        required={required}
        disabled={disabled}
        placeholder={disabled ? "Select district first" : loading ? "Loading…" : "Type your block / tehsil"}
        value={text}
        onChange={(e) => {
          set(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && showList && options[activeIndex]) {
            e.preventDefault();
            pick(options[activeIndex]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={inputClasses}
      />
      {showList && (
        <ul id={listId} role="listbox" aria-label="Blocks in this district" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-white py-1 shadow-e2">
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                // mousedown, not click: blur would close the list before click could fire.
                e.preventDefault();
                pick(o);
              }}
              className={cn("flex min-h-11 cursor-pointer items-center px-3 py-2 text-sm", i === activeIndex ? "bg-lavender text-navy" : "text-ink")}
            >
              {o.name}
            </li>
          ))}
        </ul>
      )}
      {!disabled && needle.length >= 2 && !exact && (
        <p className="mt-1 text-caption text-muted">Not in our list yet — it will be added to this district.</p>
      )}
    </div>
  );
}
