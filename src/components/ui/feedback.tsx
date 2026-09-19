import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Inbox, RefreshCw } from "lucide-react";
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
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-4 text-sm", cls, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface/50 px-6 py-14 text-center", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender text-navy">{icon ?? <Inbox className="h-7 w-7" />}</div>
      <h3 className="text-base font-bold text-navy">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, onRetry, retryHref, className }: { title?: string; description?: React.ReactNode; onRetry?: () => void; retryHref?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-card border border-danger/20 bg-danger-light/40 px-6 py-14 text-center", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-danger shadow-sm">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h3 className="text-base font-bold text-navy">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {onRetry && (
        <Button variant="navy" size="md" className="mt-5" onClick={onRetry} leftIcon={<RefreshCw className="h-4 w-4" />}>
          Try again
        </Button>
      )}
      {retryHref && (
        <ButtonLink href={retryHref} variant="navy" size="md" className="mt-5" leftIcon={<RefreshCw className="h-4 w-4" />}>
          Try again
        </ButtonLink>
      )}
    </div>
  );
}

/* ───────────── Skeletons ───────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-line/70", className)} aria-hidden />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card space-y-3 p-5">
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
    <span className={cn("inline-block h-5 w-5 animate-spin rounded-full border-2 border-navy/20 border-t-navy", className)} role="status" aria-label="Loading" />
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted">
      <Spinner /> {label}
    </div>
  );
}
