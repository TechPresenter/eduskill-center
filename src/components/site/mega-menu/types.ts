/**
 * Data contract for the "Courses" mega menu. Plain serialisable values only: the server loader
 * (`getCoursesMenu()` in src/server/nav-menu.ts) builds it and the header passes it straight into the
 * client components in this folder.
 */

/** Tint of a row's icon tile. Popular courses cycle the first four; quick links pick one each. */
export const MEGA_TONES = ["orange", "blue", "purple", "rose", "green", "amber", "navy"] as const;
export type MegaTone = (typeof MEGA_TONES)[number];

export interface MegaMenuLink {
  title: string;
  /** One muted line under the title. */
  subtitle: string;
  /** App-relative href ("/courses?category=…") or an absolute URL. Rendered with <Link>. */
  href: string;
  /** Lucide icon name, resolved by DynamicIcon (unknown names fall back to Sparkles). */
  icon: string;
  tone: MegaTone;
}

export interface MegaMenuFeature {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface CoursesMenuData {
  feature: MegaMenuFeature;
  /** Active course categories that have at least one active course (max 4), from the database. */
  popular: MegaMenuLink[];
  /** CMS-editable links (Admin → CMS → Website sections → Global → Courses mega menu), max 4. */
  quickLinks: MegaMenuLink[];
}

export function isMegaTone(value: unknown): value is MegaTone {
  return typeof value === "string" && (MEGA_TONES as readonly string[]).includes(value);
}
