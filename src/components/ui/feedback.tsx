import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";

export type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT: Record<AlertTone, { cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  info: { cls: "border-info/30 bg-info-light text-blue-900", Icon: Info },
  success: { cls: "border-success/30 bg-success-light text-green-900", Icon: CheckCircle2 },
  warning: { cls: "border-warning/30 bg-warning-light text-amber-900", Icon: AlertTriangle },
  danger: { cls: "border-danger/30 bg-danger-light text-red-900", Icon: AlertCircle },
};

export function Alert({ tone = "info", title, children, className, action }: { tone?: AlertTone; title?: React.ReactNode; children?: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const { cls, Icon } = ALERT[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("text-body-sm flex gap-3 rounded-card border p-4", cls, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="text-h4">{title}</p>}
        {children && <div className={cn(title && "mt-1", "opacity-90")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ───────────── Empty states ─────────────
 * ONE implementation. `EmptyRow` (table.tsx) and `CardList` (responsive-table.tsx) both render this
 * through `EmptyContent`, so a table, a phone card list and a standalone panel say "nothing here"
 * the same way — and they share EMPTY_MESSAGE rather than each keeping their own string.
 */

/** The single default "there is nothing here yet" line. */
export const EMPTY_MESSAGE = "No records found.";

/**
 * Branded placeholder mark: lavender tile, concentric navy rings, the Foundation's cap, one orange
 * accent. Inline SVG — no image request, no client JS, ~0.4KB. Used whenever no `icon` is supplied,
 * because a brand-new Foundation sees this state on almost every screen before its first record.
 */
function EmptyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <rect width="64" height="64" rx="18" fill="#e8eaf6" />
      <circle cx="32" cy="33" r="21.5" fill="none" stroke="#12357a" strokeOpacity="0.16" strokeWidth="1.25" />
      <circle cx="32" cy="33" r="14.5" fill="none" stroke="#12357a" strokeOpacity="0.26" strokeWidth="1.25" />
      <path d="M32 19.5 47 26.5 32 33.5 17 26.5Z" fill="#12357a" />
      <path d="M23.5 30.2v7.3c0 2.9 3.8 5 8.5 5s8.5-2.1 8.5-5v-7.3" fill="none" stroke="#12357a" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      <path d="M45.5 27.4v6.2" fill="none" stroke="#e8520a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="45.5" cy="36.2" r="2.3" fill="#e8520a" />
    </svg>
  );
}

export interface EmptyStateProps {
  /** A lucide icon (rendered in a lavender tile). Omit it to get the branded mark. */
  icon?: React.ReactNode;
  title?: React.ReactNode;
  /** One line of guidance: what this screen will hold, or what to do next. */
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** `sm` is the compact step used inside tables and cards; `md` is the standalone panel. */
  size?: "sm" | "md";
  /** Drop the dashed frame when the state already sits inside a card, a table row or a sheet. */
  bare?: boolean;
}

export function EmptyState({ icon, title = EMPTY_MESSAGE, description, action, className, size = "md", bare }: EmptyStateProps) {
  const sm = size === "sm";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        sm ? "py-10" : "py-14",
        !bare && "rounded-card border border-dashed border-line bg-surface/60",
        className
      )}
    >
      {icon ? (
        <span className={cn("mb-4 flex items-center justify-center rounded-md bg-lavender text-navy", sm ? "h-12 w-12" : "h-14 w-14")}>{icon}</span>
      ) : (
        <EmptyMark className={cn("mb-4", sm ? "h-12 w-12" : "h-16 w-16")} />
      )}
      <h3 className={cn("text-navy", sm ? "text-h4" : "text-h3")}>{title}</h3>
      {description && <p className="text-body mt-1.5 max-w-md text-muted">{description}</p>}
      {action && <div className={cn(sm ? "mt-4" : "mt-6")}>{action}</div>}
    </div>
  );
}

/**
 * Resolves the `empty` / `emptyState` slot that lists accept: a plain string (or nothing) becomes the
 * shared EmptyState, while a caller-supplied node is rendered as-is. Keeps EmptyRow and CardList from
 * growing their own empty-state markup again.
 */
export function EmptyContent({ content, size, bare, className }: { content?: React.ReactNode; size?: "sm" | "md"; bare?: boolean; className?: string }) {
  if (content !== undefined && content !== null && typeof content !== "string" && typeof content !== "number") return <>{content}</>;
  return <EmptyState title={content ?? EMPTY_MESSAGE} size={size} bare={bare} className={className} />;
}

export function ErrorState({ title = "Something went wrong", description, onRetry, retryHref, className }: { title?: string; description?: React.ReactNode; onRetry?: () => void; retryHref?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-card border border-danger/20 bg-danger-light/40 px-6 py-14 text-center", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-white text-danger shadow-e1">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h3 className="text-h3 text-navy">{title}</h3>
      {description && <p className="text-body mt-1.5 max-w-md text-muted">{description}</p>}
      {onRetry && (
        <Button variant="navy" size="md" className="mt-6" onClick={onRetry} leftIcon={<RefreshCw className="h-4 w-4" />}>
          Try again
        </Button>
      )}
      {retryHref && (
        <ButtonLink href={retryHref} variant="navy" size="md" className="mt-6" leftIcon={<RefreshCw className="h-4 w-4" />}>
          Try again
        </ButtonLink>
      )}
    </div>
  );
}

/* ───────────── Skeletons ───────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-line/70 motion-reduce:animate-none", className)} aria-hidden />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card card-p space-y-3">
      <Skeleton className="h-5 w-1/2" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Placeholder for a mobile card list (the phone counterpart of SkeletonTable). */
export function SkeletonCardList({ count = 4, lines = 3, className }: { count?: number; lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          {Array.from({ length: lines }).map((_, l) => (
            <div key={l} className="flex justify-between gap-4">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3.5 w-1/3" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Placeholder for avatar + two-line rows (notifications, students, messages). */
export function SkeletonList({ rows = 6, avatar = true, className }: { rows?: number; avatar?: boolean; className?: string }) {
  return (
    <div className={cn("card divide-y divide-line", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          {avatar && <Skeleton className="h-10 w-10 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

/**
 * Table placeholder. Below `md` (where TableWrap switches to cards) it renders SkeletonCardList so the
 * loading state matches the layout that replaces it; pass `cards={false}` for scroll-only tables.
 */
export function SkeletonTable({ rows = 6, cols = 5, cards = true }: { rows?: number; cols?: number; cards?: boolean }) {
  return (
    <>
      {cards && <SkeletonCardList count={Math.min(rows, 4)} lines={Math.min(Math.max(cols - 1, 1), 3)} className="md:hidden" />}
      <div className={cn("card overflow-hidden", cards && "hidden md:block")} aria-hidden>
        <div className="flex gap-4 border-b border-line bg-surface px-4 py-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 border-b border-line px-4 py-3.5 last:border-0">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block h-5 w-5 animate-spin rounded-full border-2 border-navy/20 border-t-navy motion-reduce:animate-none", className)} role="status" aria-label="Loading" />
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="text-body-sm flex items-center justify-center gap-3 py-16 text-muted">
      <Spinner /> {label}
    </div>
  );
}
