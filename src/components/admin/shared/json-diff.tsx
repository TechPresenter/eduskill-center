import * as React from "react";
import { cn } from "@/lib/utils";

type Flat = Record<string, unknown>;

function flatten(value: unknown, prefix = "", out: Flat = {}): Flat {
  if (value === null || value === undefined) {
    if (prefix) out[prefix] = value;
    return out;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) out[prefix || "[]"] = [];
    value.forEach((v, i) => flatten(v, prefix ? `${prefix}[${i}]` : `[${i}]`, out));
    return out;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0 && prefix) out[prefix] = {};
    for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    return out;
  }
  out[prefix || "value"] = value;
  return out;
}

function show(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length === 0) return "[]";
  if (typeof v === "object" && Object.keys(v as object).length === 0) return "{}";
  return JSON.stringify(v);
}

const SKIP = new Set(["updatedAt", "passwordHash"]);

const ROW_TONE: Record<string, string> = {
  changed: "bg-warning-light/60",
  added: "bg-success-light/60",
  removed: "bg-danger-light/60",
  same: "",
};

const KIND_LABEL: Record<string, string> = { changed: "Changed", added: "Added", removed: "Removed", same: "Unchanged" };

/**
 * Comparison of two JSON values. Changed keys are highlighted; unchanged keys are hidden unless
 * `showUnchanged`. Below `md` each field becomes a stacked block (before / after on their own lines,
 * long JSON wrapped) because the three-column table needs 520px; from `md` up the table is used.
 */
export function JsonDiff({ oldValue, newValue, showUnchanged = false, className }: { oldValue: unknown; newValue: unknown; showUnchanged?: boolean; className?: string }) {
  const a = flatten(oldValue ?? {});
  const b = flatten(newValue ?? {});
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))
    .filter((k) => !SKIP.has(k.split(".").pop() ?? k))
    .sort();
  const rows = keys.map((k) => {
    const inA = k in a;
    const inB = k in b;
    const same = inA && inB && JSON.stringify(a[k]) === JSON.stringify(b[k]);
    const kind: "same" | "added" | "removed" | "changed" = same ? "same" : !inA ? "added" : !inB ? "removed" : "changed";
    return { key: k, before: inA ? show(a[k]) : "—", after: inB ? show(b[k]) : "—", kind };
  });
  const visible = showUnchanged ? rows : rows.filter((r) => r.kind !== "same");
  const changedCount = rows.filter((r) => r.kind !== "same").length;

  if (keys.length === 0) return <p className="text-sm text-muted">No values recorded.</p>;

  const summary = (
    <p className="border-t border-line bg-surface px-3 py-1.5 text-xs text-muted">
      {changedCount} changed field{changedCount === 1 ? "" : "s"} · {rows.length - changedCount} unchanged{!showUnchanged && rows.length - changedCount > 0 ? " (hidden)" : ""}
    </p>
  );

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line", className)}>
      {/* Phones: stacked blocks. */}
      <ul className="divide-y divide-line md:hidden">
        {visible.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">No changes between the recorded values.</li>}
        {visible.map((r) => (
          <li key={r.key} className={cn("px-3 py-3", ROW_TONE[r.kind])}>
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold break-all text-ink">{r.key}</span>
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">{KIND_LABEL[r.kind]}</span>
            </p>
            {r.kind !== "added" && (
              <p className="mt-1.5 text-xs">
                <span className="font-semibold tracking-wide text-muted uppercase">Before</span>
                <span className={cn("mt-0.5 block font-mono break-words whitespace-pre-wrap text-muted", (r.kind === "changed" || r.kind === "removed") && "line-through decoration-danger/50")}>{r.before}</span>
              </p>
            )}
            {r.kind !== "removed" && (
              <p className="mt-1.5 text-xs">
                <span className="font-semibold tracking-wide text-muted uppercase">After</span>
                <span className="mt-0.5 block font-mono break-words whitespace-pre-wrap text-ink">{r.after}</span>
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Desktop: the original three-column table. */}
      <div className="scrollbar-thin hidden overflow-x-auto md:block">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="bg-surface text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Before</th>
              <th className="px-3 py-2">After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-muted">
                  No changes between the recorded values.
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.key} className={ROW_TONE[r.kind]}>
                <td className="px-3 py-2 font-mono font-medium text-ink whitespace-nowrap">{r.key}</td>
                <td className={cn("max-w-[18rem] px-3 py-2 break-words whitespace-pre-wrap text-muted", (r.kind === "changed" || r.kind === "removed") && "line-through decoration-danger/50")}>{r.before}</td>
                <td className="max-w-[18rem] px-3 py-2 break-words whitespace-pre-wrap text-ink">{r.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary}
    </div>
  );
}
