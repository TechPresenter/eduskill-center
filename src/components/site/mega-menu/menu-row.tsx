import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { IconTile } from "@/components/site/decor";
import { cn } from "@/lib/utils";
import type { MegaMenuLink, MegaTone } from "./types";

/**
 * Tint overrides for IconTile (which only ships orange / lavender / navy tones). Passed as className,
 * so tailwind-merge replaces IconTile's own bg / text / ring colour. Glyph colours are picked for at
 * least 3:1 against their tint (WCAG non-text contrast).
 */
export const TONE_TILE: Record<MegaTone, string> = {
  orange: "bg-orange-light text-orange ring-orange/15",
  blue: "bg-info-light text-blue-600 ring-blue-600/15",
  purple: "bg-violet-50 text-violet-600 ring-violet-600/15",
  rose: "bg-danger-light text-rose-600 ring-rose-600/15",
  green: "bg-success-light text-success-dark ring-success/20",
  amber: "bg-warning-light text-amber-600 ring-amber-600/15",
  navy: "bg-lavender text-navy ring-navy/10",
};

/**
 * One row of the mega menu: tinted icon tile, navy title, muted one-line subtitle, chevron.
 * `variant="desktop"` is the compact panel row; `variant="mobile"` is the 56px app-style list row.
 */
export function MegaMenuRow({
  item,
  onNavigate,
  variant = "desktop",
}: {
  item: MegaMenuLink;
  onNavigate?: () => void;
  variant?: "desktop" | "mobile";
}) {
  const mobile = variant === "mobile";
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      data-mega-item=""
      className={cn(
        "group flex items-center gap-3 rounded-md ring-focus tap-highlight-none transition-colors duration-micro motion-reduce:transition-none",
        mobile ? "min-h-14 px-2.5 py-2 active:bg-surface" : "min-h-14 px-2.5 py-2 hover:bg-surface focus-visible:bg-surface"
      )}
    >
      {/* rounded-md: the reference tiles are rounded squares; IconTile's own sm radius (20px on 40px) reads as a circle. */}
      <IconTile icon={item.icon} size="sm" className={cn("rounded-md", TONE_TILE[item.tone])} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-semibold text-navy", mobile ? "text-[15px] leading-5" : "text-[14px] leading-5 group-hover:text-navy-dark")}>{item.title}</span>
        {item.subtitle && (
          <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-muted" title={item.subtitle}>
            {item.subtitle}
          </span>
        )}
      </span>
      <ChevronRight
        aria-hidden
        className={cn(
          "h-4 w-4 shrink-0 text-muted transition-[translate,color] duration-micro motion-reduce:transition-none",
          !mobile && "group-hover:translate-x-0.5 group-hover:text-orange group-focus-visible:text-orange"
        )}
      />
    </Link>
  );
}
