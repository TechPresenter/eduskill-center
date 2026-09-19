"use client";

import * as React from "react";
import { useIsDesktop } from "@/lib/hooks";
import { DateRangeInput } from "@/components/ui/date-input";
import { useUrlParams } from "@/components/admin/shared/use-url-params";

/**
 * "Submitted between" filter bound to the `from` / `to` query params that
 * `centreApplicationListSchema` understands (the shared DateRangeFilter writes a `range`
 * preset the centre-application list query does not accept).
 *
 * At `lg`+ it sits inline in the FilterBar card and pushes the URL on blur. Below `lg` it is
 * rendered inside the FilterBar's bottom sheet, where the named inputs are submitted with the
 * rest of the form when "Apply filters" is tapped, so no navigation happens under the sheet.
 */
export function SubmittedRangeFilter() {
  const isDesktop = useIsDesktop();
  const { get, set } = useUrlParams();
  const urlFrom = get("from");
  const urlTo = get("to");
  const [range, setRange] = React.useState({ from: urlFrom, to: urlTo });
  const [synced, setSynced] = React.useState(`${urlFrom}|${urlTo}`);
  // Re-sync when the URL changes from outside (Reset, another control) – during render, not in an effect.
  if (synced !== `${urlFrom}|${urlTo}`) {
    setSynced(`${urlFrom}|${urlTo}`);
    setRange({ from: urlFrom, to: urlTo });
  }

  return (
    <div
      className={isDesktop ? "min-w-[18rem]" : "w-full min-w-0"}
      onBlur={() => {
        if (!isDesktop) return;
        if (range.from === urlFrom && range.to === urlTo) return;
        set({ from: range.from || undefined, to: range.to || undefined });
      }}
    >
      <span className={isDesktop ? "mb-1 block text-xs font-medium text-muted" : "mb-1 block text-[13px] font-medium text-muted"}>Submitted between</span>
      <DateRangeInput from={range.from} to={range.to} onChange={(v) => setRange(v)} max={new Date()} />
    </div>
  );
}
