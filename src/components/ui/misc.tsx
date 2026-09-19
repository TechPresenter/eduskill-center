import * as React from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { SetMobileHeader } from "@/components/portal/header-context";

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(11, size / 2.6) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} width={size} height={size} loading="lazy" decoding="async" style={style} className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span style={style} className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-navy-soft font-bold text-navy", className)} aria-label={name}>
      {initials(name) || "?"}
    </span>
  );
}

export interface StepperStep {
  label: string;
  description?: string;
}

/** Horizontal (desktop) / vertical (mobile) stepper for multi-step forms and workflows. */
export function Stepper({ steps, current, className }: { steps: StepperStep[]; current: number; className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0", className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.label} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center">
            <div className="flex items-center sm:w-full">
              <span className="hidden h-0.5 flex-1 bg-line sm:block" style={{ visibility: i === 0 ? "hidden" : "visible", backgroundColor: done ? "#e8520a" : undefined }} />
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                  done ? "border-orange bg-orange text-white" : active ? "border-orange bg-white text-orange" : "border-line bg-white text-muted"
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="hidden h-0.5 flex-1 bg-line sm:block" style={{ visibility: i === steps.length - 1 ? "hidden" : "visible", backgroundColor: done ? "#e8520a" : undefined }} />
            </div>
            <div className="sm:mt-2 sm:px-2">
              <p className={cn("text-sm font-semibold", active || done ? "text-navy" : "text-muted")}>{s.label}</p>
              {s.description && <p className="text-xs text-muted">{s.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface TimelineItem {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  tone?: "orange" | "navy" | "success" | "danger" | "neutral";
  icon?: React.ReactNode;
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  const tone = { orange: "bg-orange", navy: "bg-navy", success: "bg-success", danger: "bg-danger", neutral: "bg-muted" };
  return (
    <ol className={cn("relative space-y-6 border-l-2 border-line pl-6", className)}>
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className={cn("absolute top-1 -left-[31px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white", tone[it.tone ?? "navy"])}>{it.icon}</span>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
            <p className="text-sm font-semibold text-ink">{it.title}</p>
            {it.meta && <span className="text-xs text-muted">{it.meta}</span>}
          </div>
          {it.description && <div className="mt-0.5 text-sm text-muted">{it.description}</div>}
        </li>
      ))}
    </ol>
  );
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Breadcrumb trail. With `collapse`, phones (< sm) see only a 44px "‹ Parent" link to the previous
 * crumb (Android back-title pattern) while the full trail renders from `sm` up.
 */
export function Breadcrumbs({ items, className, collapse }: { items: BreadcrumbItem[]; className?: string; collapse?: boolean }) {
  const parent = collapse && items.length > 1 ? items[items.length - 2] : undefined;
  return (
    <nav aria-label="Breadcrumb" className={cn("flex flex-wrap items-center gap-1 text-xs text-muted", className)}>
      {parent?.href && (
        <Link href={parent.href} className="-ml-1 inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-navy sm:hidden">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {parent.label}
        </Link>
      )}
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className={cn("h-3.5 w-3.5", parent && "hidden sm:block")} aria-hidden />}
          {it.href && i < items.length - 1 ? (
            <Link href={it.href} className={cn("hover:text-navy", parent && "hidden sm:inline")}>
              {it.label}
            </Link>
          ) : (
            <span className={cn(i === items.length - 1 && "font-medium text-ink", parent && "hidden sm:inline")} aria-current={i === items.length - 1 ? "page" : undefined}>
              {it.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Desktop (and default mobile) actions, rendered right of the title; wrap on phones. */
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
  /**
   * Route for the app-bar back arrow on phones. Leave unset on section landing pages: the shell already
   * shows a back arrow (to the section) whenever the path is deeper than its nav item.
   */
  backHref?: string;
  /** Shorter title for the phone app bar when `title` is long or contains markup. */
  mobileTitle?: React.ReactNode;
  /** A 44px control for the app bar's trailing slot; when set, `actions` are desktop-only. */
  mobileActions?: React.ReactNode;
  /**
   * Hide the in-page title below `lg` (the app bar already shows it; the h1 stays for screen readers).
   * Default `true` so the page never repeats the app-bar title; pass `false` to keep the visible h1 on phones.
   */
  hideMobileTitle?: boolean;
}

/**
 * Page title block for portals. Server-safe: it renders the client-only <SetMobileHeader> as a child so the
 * phone app bar shows the title / back arrow, keeps the h1 in the page (`text-xl lg:text-3xl`) and hides
 * breadcrumbs below `lg` where the app bar's back arrow does that job.
 */
export function PageHeader({ title, description, actions, breadcrumbs, className, backHref, mobileTitle, mobileActions, hideMobileTitle = true }: PageHeaderProps) {
  const emptyOnMobile = hideMobileTitle && !description && !actions;
  return (
    <div className={cn("mb-4 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between lg:mb-6 lg:gap-4", emptyOnMobile ? "hidden lg:flex" : "flex", className)}>
      <SetMobileHeader title={mobileTitle ?? title} backHref={backHref} action={mobileActions} />
      <div className="min-w-0">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-2 hidden lg:flex" />}
        <h1 className={cn("text-xl font-extrabold text-navy lg:text-3xl", hideMobileTitle && "sr-only lg:not-sr-only")}>{title}</h1>
        {description && <p className={cn("text-sm text-muted", hideMobileTitle ? "lg:mt-1" : "mt-1")}>{description}</p>}
      </div>
      {actions && <div className={cn("shrink-0 flex-wrap items-center gap-2", mobileActions ? "hidden lg:flex" : "flex")}>{actions}</div>}
    </div>
  );
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (!label) return <hr className={cn("border-line", className)} />;
  return (
    <div className={cn("flex items-center gap-3 text-xs text-muted", className)}>
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function KeyValue({ label, value, className }: { label: React.ReactNode; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <span className="text-sm font-medium text-ink">{value ?? "—"}</span>
    </div>
  );
}
