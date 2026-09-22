import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconTile as UiIconTile, type IconTileTone, type IconTileSize } from "@/components/ui/list";

/*
 * App-style list building blocks for the content, communication and administration screens.
 *
 * Server-safe (no "use client", no hooks): server pages render them directly and client managers
 * import them too. Everything here is built from the token layer in globals.css — `card`, the radius
 * scale, `duration-micro` + `ease-soft` for the press state, `text-*` type steps — so a list of FAQs,
 * a list of templates and a list of audit entries read as one product.
 *
 *   IconTile      a Lucide glyph in a soft tinted rounded square (the app's icon container)
 *   AppList       a card that holds rows, divided by hairlines; fades in once
 *   AppListRow    leading tile/avatar · title + secondary line · trailing value/status · chevron
 *                 64px on phones, 56px from md. Tappable rows get a 150ms press state.
 *   ListSection   an overline heading above a group of rows
 *   SaveStatus    "Unsaved changes / Saving… / Saved" as one polite, atomic status message
 */

/** One icon container for the whole product: the kit's IconTile, with this module's default tone. */
export type TileTone = Extract<IconTileTone, "lavender" | "navy" | "orange" | "success" | "warning" | "danger" | "info" | "neutral">;
export type TileSize = Extract<IconTileSize, "sm" | "md" | "lg">;

export function IconTile({ tone = "lavender", ...rest }: { children: React.ReactNode; tone?: TileTone; size?: TileSize; className?: string }) {
  return <UiIconTile tone={tone} {...rest} />;
}

/** Row container: one card, hairline dividers, fades in once (opacity only — no transform, so no containing block). */
export function AppList({ children, className, "aria-label": ariaLabel, "aria-labelledby": labelledBy }: { children: React.ReactNode; className?: string; "aria-label"?: string; "aria-labelledby"?: string }) {
  return (
    <ul aria-label={ariaLabel} aria-labelledby={labelledBy} className={cn("card animate-fade-in divide-y divide-line overflow-hidden motion-reduce:animate-none", className)}>
      {children}
    </ul>
  );
}

/** Overline heading for a group of rows ("Admissions", "Home page"…). */
export function ListSection({ title, id, count, action, children, className }: { title: React.ReactNode; id?: string; count?: number; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("space-y-2", className)}>
      <div className="flex min-h-6 items-center justify-between gap-3 px-1">
        <h2 id={id} className="text-overline text-muted">
          {title}
          {count !== undefined && <span className="ml-2 font-semibold tracking-normal text-muted/80 tabular-nums normal-case">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const ROW_INNER = "flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left md:min-h-14 sm:px-5";
const ROW_PRESS =
  "tap-highlight-none transition-colors duration-micro ease-soft motion-reduce:transition-none active:bg-surface md:hover:bg-surface/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange";

export interface AppListRowProps {
  /** Leading visual: an `IconTile`, an `Avatar` or a thumbnail. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** Secondary line under the title (muted, one step smaller). */
  subtitle?: React.ReactNode;
  /** Third line for chips / meta (wraps). */
  meta?: React.ReactNode;
  /** Right-aligned value, badge or timestamp inside the tappable area. */
  trailing?: React.ReactNode;
  /** Makes the row a link (a chevron is shown unless `chevron={false}`). */
  href?: string;
  /** Makes the row a button (e.g. open a sheet). */
  onClick?: () => void;
  /** Accessible name for the link / button when the visible title is not enough. */
  "aria-label"?: string;
  chevron?: boolean;
  /** Controls rendered OUTSIDE the tappable area (overflow menu, toggles) so buttons never nest. */
  actions?: React.ReactNode;
  /** Emphasise the row (e.g. unread). */
  highlight?: boolean;
  className?: string;
  /** Clamp the subtitle to N lines (1 or 2). Default 2. */
  clamp?: 1 | 2 | false;
}

export function AppListRow({ leading, title, subtitle, meta, trailing, href, onClick, chevron, actions, highlight, className, clamp = 2, "aria-label": ariaLabel }: AppListRowProps) {
  const showChevron = chevron ?? (!!href || !!onClick);
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-body font-semibold break-words text-ink">{title}</span>
        {subtitle && <span className={cn("mt-0.5 block text-body-sm text-muted", clamp === 1 && "truncate", clamp === 2 && "line-clamp-2")}>{subtitle}</span>}
        {meta && <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</span>}
      </span>
      {trailing && <span className="flex shrink-0 flex-col items-end gap-1 text-right text-caption text-muted">{trailing}</span>}
      {showChevron && <ChevronRight className="h-5 w-5 shrink-0 text-muted/70" aria-hidden />}
    </>
  );
  return (
    <li className={cn("flex items-stretch", highlight && "bg-orange-light/30", className)}>
      {href ? (
        <Link href={href} aria-label={ariaLabel} className={cn(ROW_INNER, ROW_PRESS)}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn(ROW_INNER, ROW_PRESS, "w-full")}>
          {body}
        </button>
      ) : (
        <div className={ROW_INNER}>{body}</div>
      )}
      {actions && <div className="flex shrink-0 items-center gap-1 pr-2 sm:pr-3">{actions}</div>}
    </li>
  );
}

/** Loading placeholder shaped exactly like an `AppList` of rows. */
export function AppListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("card divide-y divide-line overflow-hidden", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-3 md:min-h-14 sm:px-5">
          <span className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-line/70 motion-reduce:animate-none" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-4 w-2/3 animate-pulse rounded-sm bg-line/70 motion-reduce:animate-none" />
            <span className="block h-3 w-1/2 animate-pulse rounded-sm bg-line/70 motion-reduce:animate-none" />
          </span>
          <span className="h-5 w-14 shrink-0 animate-pulse rounded-full bg-line/70 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

export type SaveState = "clean" | "dirty" | "saving" | "saved" | "error";

const SAVE_DOT: Record<SaveState, string> = {
  clean: "bg-line",
  dirty: "bg-orange",
  saving: "bg-info animate-pulse motion-reduce:animate-none",
  saved: "bg-success",
  error: "bg-danger",
};

/**
 * One polite, atomic status line for an editor ("Unsaved changes", "Saving…", "All changes saved").
 * `idle` is what a clean editor says (e.g. "Last saved 12 Sep, 4:10 pm" or "Using built-in defaults").
 */
export function SaveStatus({ state, idle, className }: { state: SaveState; idle?: React.ReactNode; className?: string }) {
  const label = state === "dirty" ? "Unsaved changes" : state === "saving" ? "Saving…" : state === "saved" ? "All changes saved" : state === "error" ? "Not saved – fix the errors above" : idle;
  if (!label) return null;
  return (
    <p role="status" aria-atomic="true" className={cn("inline-flex min-w-0 items-center gap-2 text-caption", state === "dirty" ? "font-semibold text-orange" : state === "error" ? "font-semibold text-danger" : "text-muted", className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", SAVE_DOT[state])} aria-hidden />
      <span className="truncate">{label}</span>
    </p>
  );
}

export interface StatStripItem {
  label: string;
  value: React.ReactNode;
  /** Colour of the number. */
  tone?: "navy" | "orange" | "success" | "warning" | "danger" | "muted";
  href?: string;
  hint?: string;
}

const STAT_TONE: Record<NonNullable<StatStripItem["tone"]>, string> = {
  navy: "text-navy",
  orange: "text-orange",
  success: "text-success-dark",
  warning: "text-warning-dark",
  danger: "text-danger",
  muted: "text-muted",
};

/**
 * Compact row of 2–4 numbers (label over a tabular figure). Three full StatsCards would stack into a
 * screen of their own on a phone; this is one swipeable row there. Items with `href` are tappable.
 */
export function StatStrip({ items, className }: { items: StatStripItem[]; className?: string }) {
  return (
    // Phones: a swipeable row of fixed-width tiles (money never gets truncated); sm+: an even grid.
    <ul className={cn(items.length > 2 ? "hscroll gap-2 pb-1 sm:mx-0 sm:grid sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0" : "grid grid-cols-2 gap-2 sm:gap-3", items.length >= 4 ? "sm:grid-cols-4" : items.length === 3 ? "sm:grid-cols-3" : "", className)}>
      {items.map((s) => {
        const body = (
          <>
            <span className="block truncate text-caption font-semibold tracking-wide text-muted uppercase">{s.label}</span>
            <span className={cn("block truncate text-h3 whitespace-nowrap tabular-nums", STAT_TONE[s.tone ?? "navy"])}>{s.value}</span>
            {s.hint && <span className="block truncate text-caption text-muted">{s.hint}</span>}
          </>
        );
        return (
          <li key={s.label} className={cn("min-w-0", items.length > 2 && "w-[9.5rem] sm:w-auto")}>
            {s.href ? (
              <Link href={s.href} className="card ring-focus block h-full px-3 py-3 tap-highlight-none transition-colors duration-micro ease-soft active:bg-surface motion-reduce:transition-none sm:px-4 md:hover:bg-surface/60">
                {body}
              </Link>
            ) : (
              <div className="card h-full px-3 py-3 sm:px-4">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
