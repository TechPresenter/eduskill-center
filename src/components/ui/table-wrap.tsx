"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Table container (client component so it can label cells for the mobile card layout).
 * Below the md breakpoint rows become stacked cards (`cards`, default true): each cell shows the
 * matching column header as its label. Use `<TD label="…">` to override, `<TD mobile="full">` for a
 * full-width primary cell, `mobile="actions"` for a right-aligned actions row and `mobile="hidden"`
 * to drop a cell on phones. Keep this file separate from table.tsx so Pagination and the other
 * table primitives stay server-safe (server pages pass functions such as `hrefFor` to them).
 */
export function TableWrap({ className, children, cards = true }: { className?: string; children: React.ReactNode; cards?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!cards) return;
    const root = ref.current;
    if (!root) return;
    const apply = () => {
      const table = root.querySelector("table");
      if (!table) return;
      const labels = Array.from(table.querySelectorAll("thead th")).map((th) => (th.querySelector(".sr-only") ? "" : (th.textContent ?? "").trim()));
      table.querySelectorAll("tbody tr").forEach((tr) => {
        Array.from(tr.children).forEach((cell, i) => {
          if (!(cell instanceof HTMLTableCellElement) || cell.hasAttribute("data-label")) return;
          cell.setAttribute("data-label", cell.colSpan > 1 ? "" : (labels[i] ?? ""));
        });
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [cards]);
  return (
    <div
      ref={ref}
      className={cn(
        "scrollbar-thin relative w-full max-w-full overflow-x-auto [contain:inline-size]",
        // The table container IS a card: one radius, one border, one resting elevation (e1). In card
        // mode the chrome only appears from md up, because below it every row is already its own card.
        cards ? "table-cards md:rounded-card md:border md:border-line md:bg-white md:shadow-e1" : "rounded-card border border-line bg-white shadow-e1",
        className
      )}
    >
      <table className={cn("text-body-sm w-full text-left", cards ? "md:min-w-[640px]" : "min-w-[640px]")}>{children}</table>
    </div>
  );
}
