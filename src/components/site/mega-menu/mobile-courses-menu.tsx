"use client";

import * as React from "react";
import { ArrowRight, BookOpen, ChevronDown } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MegaMenuRow } from "./menu-row";
import type { CoursesMenuData, MegaMenuLink } from "./types";

/**
 * "Courses" entry for the header's full-height mobile sheet: an accordion row styled like the sheet's
 * other rows that expands to "View All Courses", then Popular Courses and Quick Links as 56px app-style
 * list rows. Render it inside the sheet's `<li>` in place of the plain Courses link.
 *
 * The collapsed body is `inert` (out of the tab order and the accessibility tree) and animates its
 * height with a grid-rows transition — no transform, so nothing here can contain a fixed descendant.
 */
export function MobileCoursesMenu({
  data,
  label = "Courses",
  active = false,
  onNavigate,
  defaultExpanded,
}: {
  data: CoursesMenuData;
  label?: string;
  /** The current route is the course catalogue: highlights the row and starts expanded. */
  active?: boolean;
  /** Called when any link is followed — pass the sheet's close handler. */
  onNavigate?: () => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded ?? active);
  const baseId = React.useId();
  const bodyId = `${baseId}-body`;

  return (
    <>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[15px] font-semibold ring-focus tap-highlight-none transition-colors duration-micro active:bg-surface motion-reduce:transition-none",
          active ? "bg-orange-light text-orange" : "text-navy"
        )}
      >
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", active ? "bg-orange text-white" : "bg-lavender text-navy")}>
          <BookOpen className="h-4.5 w-4.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown aria-hidden className={cn("mr-0.5 h-4 w-4 shrink-0 text-muted transition-transform duration-element ease-soft motion-reduce:transition-none", expanded && "rotate-180")} />
      </button>

      <div
        id={bodyId}
        inert={!expanded}
        className={cn("grid transition-[grid-template-rows] duration-element ease-soft motion-reduce:transition-none", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        {/* overflow-clip (not hidden): clips the collapsing rows without creating a scroll container. */}
        <div className="min-h-0 overflow-clip">
          <div className="pt-2 pb-3 pl-3">
            {data.feature.ctaLabel && (
              <ButtonLink href={data.feature.ctaHref} fullWidth size="sm" className="sm:h-11" onClick={onNavigate} rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}>
                {data.feature.ctaLabel}
              </ButtonLink>
            )}
            <MobileGroup id={`${baseId}-popular`} title="Popular courses" items={data.popular} onNavigate={onNavigate} />
            <MobileGroup id={`${baseId}-quick`} title="Quick links" items={data.quickLinks} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </>
  );
}

function MobileGroup({ id, title, items, onNavigate }: { id: string; title: string; items: MegaMenuLink[]; onNavigate?: () => void }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p id={id} className="px-2.5 pb-1 text-overline text-muted">
        {title}
      </p>
      <ul aria-labelledby={id} className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href + item.title}>
            <MegaMenuRow item={item} onNavigate={onNavigate} variant="mobile" />
          </li>
        ))}
      </ul>
    </div>
  );
}
