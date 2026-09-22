import * as React from "react";
import Link from "next/link";
import { ChevronRight, type LucideProps } from "lucide-react";
import { DynamicIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/*
 * App-style list primitives — the pieces every "stylish app" screen is built from.
 *
 *   IconTile       a Lucide icon in a soft tinted rounded square (sm 36 · md 40 · lg 48 · xl 56)
 *   ListGroup      a rounded card of rows with hairline dividers (optionally under a SectionHeader)
 *   ListRow        leading tile/avatar · bold title over a muted secondary line · trailing value,
 *                  status or chevron. 56px minimum, 150ms press state, optional href / onClick.
 *   SectionHeader  an overline (or h4) heading with an optional trailing action ("See all")
 *   Section        SectionHeader + its content, wired up with aria-labelledby when given an id
 *
 * Server-safe: no "use client", no hooks. Server pages render them directly; client components import
 * them too. Motion is colour-only on rows (no transform — a row must never become the containing block
 * of a fixed sheet a row action opens) and one opacity fade on the group, both honouring reduced motion.
 */

/* ────────────────────────────── IconTile ────────────────────────────── */

export type IconTileTone = "navy" | "orange" | "success" | "warning" | "danger" | "info" | "muted" | "neutral" | "lavender" | "navy-solid" | "white" | "outline";
export type IconTileSize = "sm" | "md" | "lg" | "xl";

const TILE_TONE: Record<IconTileTone, string> = {
  /** Soft navy tint: the default for navigation and neutral records. */
  navy: "bg-navy-soft/70 text-navy",
  orange: "bg-orange-light text-orange",
  success: "bg-success-light text-success-dark",
  warning: "bg-warning-light text-warning-dark",
  danger: "bg-danger-light text-danger",
  info: "bg-info-light text-info-dark",
  /** Quiet: disabled, archived, "other". The hairline keeps it visible on a white card. */
  muted: "bg-surface text-muted ring-1 ring-inset ring-line",
  /** Alias of `muted`, the name the admin list kits use. */
  neutral: "bg-surface text-muted ring-1 ring-inset ring-line",
  lavender: "bg-lavender text-navy",
  /** Solid brand tile, for a single emphasised mark (never a whole list of them). */
  "navy-solid": "bg-navy text-white",
  /** On navy surfaces. */
  white: "bg-white/12 text-white ring-1 ring-inset ring-white/20",
  outline: "bg-transparent text-navy ring-1 ring-inset ring-line",
};

/** Box, radius and glyph size per step. `[&_svg]` sizes an icon ELEMENT passed in, too. */
const TILE_SIZE: Record<IconTileSize, { box: string; icon: string; glyph: string }> = {
  sm: { box: "size-9 rounded-md [&_svg]:size-4", icon: "size-4", glyph: "text-base" },
  md: { box: "size-10 rounded-md [&_svg]:size-5", icon: "size-5", glyph: "text-lg" },
  lg: { box: "size-12 rounded-lg [&_svg]:size-6", icon: "size-6", glyph: "text-xl" },
  xl: { box: "size-14 rounded-xl [&_svg]:size-7", icon: "size-7", glyph: "text-2xl" },
};

export interface IconTileProps {
  /**
   * A lucide component (`icon={BookOpen}`), a rendered element (`icon={<BookOpen />}`), a lucide name
   * from the CMS catalog (`icon="BookOpen"`, via DynamicIcon) or a short emoji (`icon="🎓"`).
   * `children` works as well, for callers that already pass the icon as a child.
   */
  icon?: React.ComponentType<LucideProps> | React.ReactElement | string | null;
  children?: React.ReactNode;
  tone?: IconTileTone;
  size?: IconTileSize;
  /** Give the tile an accessible name when it is the only carrier of meaning (it becomes role="img"). */
  label?: string;
  className?: string;
}

function renderGlyph(icon: IconTileProps["icon"], iconClass: string, glyphClass: string): React.ReactNode {
  if (icon == null || icon === "") return null;
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === "string") {
    // A lucide name always starts with an ASCII letter; a SHORT string that does not is an emoji.
    // Longer non-letter strings are bad CMS data and fall back to DynamicIcon's default glyph.
    if (!/^[A-Za-z]/.test(icon) && [...icon].length <= 4) return <span className={cn("leading-none", glyphClass)}>{icon}</span>;
    return <DynamicIcon name={icon} className={iconClass} aria-hidden="true" />;
  }
  const Icon = icon;
  return <Icon className={iconClass} aria-hidden="true" />;
}

/** The app's one icon container: a Lucide glyph in a soft tinted rounded square. Decorative by default. */
export function IconTile({ icon, children, tone = "navy", size = "md", label, className }: IconTileProps) {
  const s = TILE_SIZE[size];
  return (
    <span
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden", s.box, TILE_TONE[tone], className)}
    >
      {renderGlyph(icon, s.icon, s.glyph) ?? children}
    </span>
  );
}

/* ─────────────────────────── SectionHeader / Section ─────────────────────────── */

export interface SectionHeaderProps {
  title: React.ReactNode;
  /** Muted line under the title. */
  description?: React.ReactNode;
  /** Trailing control: a "See all" link, a small button, a count. */
  action?: React.ReactNode;
  /** A number shown beside an overline title (tabular figures). */
  count?: number;
  /** `overline` (default) labels a list group; `title` is a bolder h4 for a screen section. */
  variant?: "overline" | "title";
  as?: "h2" | "h3" | "h4";
  id?: string;
  className?: string;
}

export function SectionHeader({ title, description, action, count, variant = "overline", as: Tag = "h2", id, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex min-h-8 items-end justify-between gap-3 px-1", className)}>
      <div className="min-w-0">
        <Tag id={id} className={cn(variant === "overline" ? "text-overline text-muted" : "text-h4 text-navy")}>
          {title}
          {count !== undefined && <span className="ml-2 font-semibold tracking-normal normal-case tabular-nums text-muted/80">{count}</span>}
        </Tag>
        {description && <p className="mt-0.5 text-body-sm text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 text-body-sm font-semibold">{action}</div>}
    </div>
  );
}

export interface SectionProps extends Omit<SectionHeaderProps, "className"> {
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

/** A titled block of a screen. With an `id`, the section is labelled by its heading. */
export function Section({ children, className, headerClassName, id, ...header }: SectionProps) {
  return (
    <section aria-labelledby={id} className={cn("space-y-2", className)}>
      <SectionHeader id={id} className={headerClassName} {...header} />
      {children}
    </section>
  );
}

/* ─────────────────────────────── ListGroup ─────────────────────────────── */

export interface ListGroupProps {
  children: React.ReactNode;
  /** Optional heading above the card (renders a Section around it). */
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  count?: number;
  /** Heading id; required for the group to be labelled by its title. */
  id?: string;
  "aria-label"?: string;
  /** Inset hairlines that start after the leading tile, like a native settings list. Default true. */
  inset?: boolean;
  className?: string;
  /** Classes for the wrapping <section> when `title` is set. */
  sectionClassName?: string;
}

/**
 * A rounded card of `ListRow`s separated by hairlines. It fades in once (opacity only — no transform,
 * so it never contains a fixed descendant).
 */
export function ListGroup({ children, title, description, action, count, id, inset = true, className, sectionClassName, "aria-label": ariaLabel }: ListGroupProps) {
  const list = (
    <ul
      aria-label={ariaLabel}
      aria-labelledby={title && id && !ariaLabel ? id : undefined}
      data-list-inset={inset ? undefined : "false"}
      className={cn("card animate-fade-in overflow-hidden motion-reduce:animate-none", className)}
    >
      {children}
    </ul>
  );
  if (!title) return list;
  return (
    <Section title={title} description={description} action={action} count={count} id={id} className={sectionClassName}>
      {list}
    </Section>
  );
}

/* ──────────────────────────────── ListRow ──────────────────────────────── */

export interface ListRowProps {
  /** Leading visual: an `IconTile`, an `Avatar` or a thumbnail. Overrides `icon`. */
  leading?: React.ReactNode;
  /** Shortcut for `leading={<IconTile icon={…} tone={…} />}`. */
  icon?: IconTileProps["icon"];
  iconTone?: IconTileTone;
  title: React.ReactNode;
  /** Secondary line under the title. */
  description?: React.ReactNode;
  /** Third line for chips / badges (wraps). */
  meta?: React.ReactNode;
  /** Right-aligned value, badge or timestamp (inside the tappable area; tabular figures). */
  trailing?: React.ReactNode;
  href?: string;
  /** Open in a new tab / plain anchor (for external or file URLs). */
  external?: boolean;
  /** Makes the row a button; with `href`, runs on click as well (e.g. close the drawer). */
  onClick?: () => void;
  /** Chevron after the trailing slot. Defaults to on for links and buttons. */
  chevron?: boolean;
  /** Controls rendered OUTSIDE the tappable area (overflow menu, switch) so interactive elements never nest. */
  actions?: React.ReactNode;
  /** Current page / selected: orange tint and `aria-current`. */
  active?: boolean;
  /** Emphasise (e.g. unread). */
  highlight?: boolean;
  /** Destructive row (Log out, Delete): red title. */
  danger?: boolean;
  disabled?: boolean;
  /** Clamp the secondary line: 1 line (default) or 2, or `false` to let it wrap. */
  clamp?: 1 | 2 | false;
  as?: "li" | "div";
  className?: string;
  "aria-label"?: string;
}

const ROW_INNER = "relative flex min-h-14 w-full min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left";
const ROW_PRESS = "press ring-focus-inset";

/**
 * One app-style list row. Put it inside a `ListGroup` (it renders an `<li>`; pass `as="div"` elsewhere).
 * Tappable rows are a single target from edge to edge with a 150ms press tint.
 */
export function ListRow({
  leading,
  icon,
  iconTone,
  title,
  description,
  meta,
  trailing,
  href,
  external,
  onClick,
  chevron,
  actions,
  active,
  highlight,
  danger,
  disabled,
  clamp = 1,
  as: Tag = "li",
  className,
  "aria-label": ariaLabel,
}: ListRowProps) {
  const interactive = !disabled && (!!href || !!onClick);
  const showChevron = chevron ?? interactive;
  const lead = leading ?? (icon ? <IconTile icon={icon} tone={iconTone ?? (danger ? "danger" : active ? "orange" : "navy")} /> : null);
  const body = (
    <>
      {lead}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-body font-semibold break-words", danger ? "text-danger" : active ? "text-orange" : "text-ink", clamp !== false && "line-clamp-2")}>{title}</span>
        {description && <span className={cn("mt-0.5 block text-body-sm text-muted", clamp === 1 && "truncate", clamp === 2 && "line-clamp-2")}>{description}</span>}
        {meta && <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</span>}
      </span>
      {trailing != null && trailing !== false && <span className="flex shrink-0 flex-col items-end gap-1 text-right text-body-sm text-muted tabular-nums">{trailing}</span>}
      {showChevron && <ChevronRight className="size-5 shrink-0 text-muted/60" aria-hidden />}
    </>
  );

  let inner: React.ReactNode;
  if (interactive && href && external) {
    inner = (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} aria-label={ariaLabel} className={cn(ROW_INNER, ROW_PRESS)}>
        {body}
      </a>
    );
  } else if (interactive && href) {
    inner = (
      <Link href={href} onClick={onClick} aria-label={ariaLabel} aria-current={active ? "page" : undefined} className={cn(ROW_INNER, ROW_PRESS)}>
        {body}
      </Link>
    );
  } else if (interactive && onClick) {
    inner = (
      <button type="button" onClick={onClick} aria-label={ariaLabel} aria-pressed={active || undefined} className={cn(ROW_INNER, ROW_PRESS)}>
        {body}
      </button>
    );
  } else {
    inner = <div className={cn(ROW_INNER, disabled && "opacity-60")}>{body}</div>;
  }

  return (
    <Tag data-list-row="" data-lead={lead ? "" : undefined} className={cn("relative flex items-stretch", active && "bg-orange-light/50", highlight && !active && "bg-orange-light/30", className)}>
      {inner}
      {actions && <div className="flex shrink-0 items-center gap-2 pr-2">{actions}</div>}
    </Tag>
  );
}

/** Loading placeholder shaped exactly like a `ListGroup` of rows. */
export function ListGroupSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("card divide-y divide-line overflow-hidden", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-3">
          <span className="size-10 shrink-0 animate-pulse rounded-md bg-line/70 motion-reduce:animate-none" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-4 w-2/3 animate-pulse rounded-sm bg-line/70 motion-reduce:animate-none" />
            <span className="block h-3 w-1/2 animate-pulse rounded-sm bg-line/70 motion-reduce:animate-none" />
          </span>
          <span className="h-4 w-10 shrink-0 animate-pulse rounded-full bg-line/70 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
