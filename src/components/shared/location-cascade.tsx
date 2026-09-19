"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface LocationValue {
  stateId?: string;
  districtId?: string;
  blockId?: string;
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
  errors?: { stateId?: string; districtId?: string; blockId?: string };
  /** Only offer locations with active training centers (public center search). */
  withCenters?: boolean;
  labels?: { state?: string; district?: string; block?: string };
  placeholderPrefix?: string;
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
export function LocationCascade({ value, onChange, depth = "block", required, errors, withCenters = false, labels, placeholderPrefix = "Select", disabled, bare, className, onNames }: LocationCascadeProps) {
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
      block: blocks.find((b) => b.id === value.blockId)?.name,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.stateId, value.districtId, value.blockId, states, districts, blocks]);

  const stateSelect = (
    <Select
      name="stateId"
      value={value.stateId ?? ""}
      onChange={(e) => onChange({ stateId: e.target.value || undefined, districtId: undefined, blockId: undefined })}
      options={states.map((s) => ({ value: s.id, label: s.name }))}
      placeholder={`${placeholderPrefix} state`}
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
      onChange={(e) => onChange({ stateId: value.stateId, districtId: e.target.value || undefined, blockId: undefined })}
      options={districts.map((d) => ({ value: d.id, label: d.name }))}
      placeholder={loading.d ? "Loading…" : value.stateId ? `${placeholderPrefix} district` : "Select state first"}
      required={required}
      disabled={disabled || !value.stateId}
      invalid={!!errors?.districtId}
      aria-label={labels?.district ?? "District"}
    />
  );
  const blockSelect = (
    <Select
      name="blockId"
      value={value.blockId ?? ""}
      onChange={(e) => onChange({ ...value, blockId: e.target.value || undefined })}
      options={blocks.map((b) => ({ value: b.id, label: b.name }))}
      placeholder={loading.b ? "Loading…" : value.districtId ? `${placeholderPrefix} block` : "Select district first"}
      required={required}
      disabled={disabled || !value.districtId}
      invalid={!!errors?.blockId}
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
    <div className={className}>
      <Field label={labels?.state ?? "State"} required={required} error={errors?.stateId}>
        {stateSelect}
      </Field>
      {depth !== "state" && (
        <Field label={labels?.district ?? "District"} required={required} error={errors?.districtId}>
          {districtSelect}
        </Field>
      )}
      {depth === "block" && (
        <Field label={labels?.block ?? "Block"} required={required} error={errors?.blockId}>
          {blockSelect}
        </Field>
      )}
    </div>
  );
}
