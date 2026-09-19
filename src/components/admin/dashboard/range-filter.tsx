"use client";

import * as React from "react";
import { CalendarRange } from "lucide-react";
import { SegmentedControl } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { DateRangeInput } from "@/components/ui/date-input";
import { useIsDesktop } from "@/lib/hooks";
import { useUrlParams } from "@/components/admin/shared/use-url-params";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "custom", label: "Custom" },
];

/**
 * Today / 7 days / 30 days / custom range selector for time-based dashboard metrics.
 * Below `lg` the strip scrolls sideways and "Custom" opens a bottom sheet with the two date fields;
 * at `lg`+ the custom range is edited inline as before.
 */
export function DashboardRangeFilter({ range, from, to }: { range: string; from?: string; to?: string }) {
  const { set } = useUrlParams();
  const isDesktop = useIsDesktop();
  const [f, setF] = React.useState(from ?? "");
  const [t, setT] = React.useState(to ?? "");
  const [open, setOpen] = React.useState(false);
  const current = PRESETS.some((p) => p.value === range) ? range : "30d";

  const applyCustom = () => {
    set({ range: "custom", from: f || undefined, to: t || undefined });
    setOpen(false);
  };

  const onSelect = (v: string) => {
    if (v !== "custom") {
      set({ range: v, from: undefined, to: undefined });
      return;
    }
    if (isDesktop) applyCustom();
    else setOpen(true);
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
      <SegmentedControl items={PRESETS} value={current} onChange={onSelect} scrollable className="max-lg:w-full" />

      {current === "custom" && isDesktop && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyCustom();
          }}
        >
          <label className="sr-only" htmlFor="dash-from">
            From
          </label>
          <Input id="dash-from" type="date" value={f} onChange={(e) => setF(e.target.value)} className="h-9 w-40 py-1" required />
          <span className="text-xs text-muted">to</span>
          <label className="sr-only" htmlFor="dash-to">
            To
          </label>
          <Input id="dash-to" type="date" value={t} onChange={(e) => setT(e.target.value)} className="h-9 w-40 py-1" required />
          <Button type="submit" size="sm" variant="navy" leftIcon={<CalendarRange className="h-4 w-4" />}>
            Apply
          </Button>
        </form>
      )}

      {current === "custom" && !isDesktop && (
        <Button type="button" size="md" variant="outline" onClick={() => setOpen(true)} leftIcon={<CalendarRange className="h-4 w-4" aria-hidden />} className="w-full">
          {f || t ? `${f || "…"} → ${t || "…"}` : "Choose dates"}
        </Button>
      )}

      {!isDesktop && (
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title="Custom range"
          description="Pick the start and end dates for the dashboard metrics."
          footer={
            <Button type="button" size="md" variant="primary" onClick={applyCustom} disabled={!f || !t} fullWidth className="sm:w-auto">
              Apply range
            </Button>
          }
        >
          <DateRangeInput from={f} to={t} onChange={(v) => { setF(v.from); setT(v.to); }} max={new Date()} className="pb-2" />
        </BottomSheet>
      )}
    </div>
  );
}
