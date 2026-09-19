"use client";

import * as React from "react";
import { api } from "@/lib/api-client";
import { cn, formatDate, titleCase } from "@/lib/utils";
import { Skeleton } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";

export interface AvailableBatch {
  id: string;
  code: string;
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  startTime: string;
  endTime: string;
  days: string[];
  room: string | null;
  status: string;
  capacity: number;
  occupied: number;
  available: number;
  trainerName: string | null;
}

interface BatchPickerProps {
  /** GET endpoint returning `{ currentBatchId, batches: AvailableBatch[] }`. */
  endpoint: string;
  value: string | null;
  onChange: (batchId: string | null, batch: AvailableBatch | null) => void;
  /** Offer a "No batch (allocate later)" option. */
  allowNone?: boolean;
  /** The record's current batch stays selectable even when full. */
  currentBatchId?: string | null;
  error?: string;
  /** Called once the list is loaded (e.g. to pre-select the current batch). */
  onLoaded?: (batches: AvailableBatch[], currentBatchId: string | null) => void;
}

type LoadState = { endpoint: string; batches: AvailableBatch[] | null; error: string | null };

/** Radio list of open batches with live seat availability (full batches are disabled). */
export function BatchPicker({ endpoint, value, onChange, allowNone, currentBatchId, error, onLoaded }: BatchPickerProps) {
  const [state, setState] = React.useState<LoadState>({ endpoint, batches: null, error: null });
  const name = React.useId();
  const onLoadedRef = React.useRef(onLoaded);
  React.useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  React.useEffect(() => {
    let cancelled = false;
    api
      .get<{ currentBatchId: string | null; batches: AvailableBatch[] }>(endpoint)
      .then((d) => {
        if (cancelled) return;
        setState({ endpoint, batches: d.batches, error: null });
        onLoadedRef.current?.(d.batches, d.currentBatchId);
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ endpoint, batches: null, error: err.message || "Could not load batches" });
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const current = state.endpoint === endpoint ? state : { endpoint, batches: null, error: null };

  if (current.error) return <p className="text-sm text-danger">{current.error}</p>;
  if (!current.batches) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  const batches = current.batches;
  const option = (b: AvailableBatch | null) => {
    const id = b?.id ?? "";
    const selected = (value ?? "") === id;
    const isCurrent = !!b && b.id === currentBatchId;
    const full = !!b && b.available <= 0 && !isCurrent;
    return (
      <label
        key={id || "none"}
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all",
          selected ? "border-orange bg-orange-light/50 ring-2 ring-orange/30" : "border-line bg-white hover:border-navy/40",
          full && "cursor-not-allowed opacity-60"
        )}
      >
        <input type="radio" name={name} className="mt-1 accent-orange" checked={selected} disabled={full} onChange={() => onChange(b ? b.id : null, b)} />
        {b ? (
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">{b.name}</span>
              <span className="font-mono text-xs text-muted">{b.code}</span>
              <Badge tone={b.status === "ONGOING" ? "success" : "info"}>{titleCase(b.status)}</Badge>
              {isCurrent && <Badge tone="navy">Current</Badge>}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {formatDate(b.startDate)} – {formatDate(b.endDate)} · {b.days.join(", ")} · {b.startTime}–{b.endTime}
              {b.room ? ` · ${b.room}` : ""}
              {b.trainerName ? ` · Trainer: ${b.trainerName}` : " · No trainer yet"}
            </span>
            <span className={cn("mt-1 inline-block text-xs font-semibold", b.available > 0 ? "text-green-700" : "text-danger")}>
              {b.available > 0 ? `${b.available} of ${b.capacity} seats free` : `Full (${b.occupied}/${b.capacity})`}
            </span>
          </span>
        ) : (
          <span className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-ink">No batch yet</span>
            <span className="block text-xs text-muted">Allocate a batch later. Admission cannot be confirmed until a batch is assigned.</span>
          </span>
        )}
      </label>
    );
  };
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Batch">
      {allowNone && option(null)}
      {batches.map((b) => option(b))}
      {batches.length === 0 && <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">No open batches for this course at this center. Create a batch first from Batches.</p>}
      {error && (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
