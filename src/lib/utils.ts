import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { format as formatDateFns, isValid, parseISO, differenceInYears } from "date-fns";
import { BASE_PATH, stripBasePath, withBasePath } from "@/lib/base-path";

/**
 * tailwind-merge has no idea what the project's own `@utility` classes in
 * `src/app/globals.css` are. Left unconfigured it files every unrecognised `text-*` token
 * under "text colour", so `cn("text-body", "text-muted")` silently drops the type-scale
 * class and the design system looks like it only applies half the time. The same blind spot
 * lets `z-overlay z-toast` or `duration-overlay duration-micro` both survive a merge.
 *
 * Teaching it the custom groups once here is what makes `cn()` safe to use with the token
 * layer: a type class and a colour class can share a call again, and the later of two
 * competing tokens wins the way it does for stock Tailwind utilities.
 */
const twMerge = extendTailwindMerge<"focus-ring">({
  extend: {
    classGroups: {
      // Type scale — `@utility text-display` … `text-input` in globals.css.
      "font-size": [
        {
          text: [
            "display",
            "h1",
            "h2",
            "h3",
            "h4",
            "body",
            "body-lg",
            "body-sm",
            "caption",
            "overline",
            "input",
            "meta",
          ],
        },
      ],
      // Elevation — three steps plus the legacy aliases that point at the same shadows.
      shadow: ["shadow-e1", "shadow-e2", "shadow-e3", "shadow-card", "shadow-card-hover", "shadow-float"],
      // Named stacking steps.
      z: ["z-raised", "z-sticky", "z-header", "z-drawer", "z-overlay", "z-toast"],
      duration: ["duration-micro", "duration-element", "duration-overlay", "duration-shine"],
      // Project radius aliases, so `rounded-card` and `rounded-full` still conflict.
      rounded: ["rounded-card", "rounded-card-lg"],
      p: ["card-p"],
      py: ["section-y"],
      // `ring-focus` / `ring-focus-inverse` draw an `outline`, not a ring, so they get their
      // own group rather than being merged away by (or merging away) a real ring colour.
      "focus-ring": [{ ring: ["focus", "focus-inverse"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toString()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function pad(num: number, width: number) {
  return String(num).padStart(width, "0");
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "object" && value !== null && "toString" in value) {
    const n = Number((value as { toString(): string }).toString());
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrDecimals = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFormat = new Intl.NumberFormat("en-IN");

export function formatINR(value: unknown, opts: { decimals?: boolean } = {}) {
  const n = toNumber(value);
  return (opts.decimals ? inrDecimals : inr).format(n);
}

export function formatNumber(value: unknown) {
  return numberFormat.format(toNumber(value));
}

export function compactNumber(value: unknown) {
  const n = toNumber(value);
  if (n >= 10000000) return `${(n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 1)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value === "string") {
    const d = parseISO(value);
    return isValid(d) ? d : null;
  }
  return null;
}

export function formatDate(value: unknown, fmt = "dd MMM yyyy") {
  const d = toDate(value);
  return d ? formatDateFns(d, fmt) : "—";
}

export function formatDateTime(value: unknown) {
  return formatDate(value, "dd MMM yyyy, hh:mm a");
}

export function dateInputValue(value: unknown) {
  const d = toDate(value);
  return d ? formatDateFns(d, "yyyy-MM-dd") : "";
}

export function calcAge(dob: unknown): number | null {
  const d = toDate(dob);
  return d ? differenceInYears(new Date(), d) : null;
}

export function titleCase(value: string | null | undefined) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function truncate(text: string, max = 140) {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export function pctOf(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

export function isUuid(v: string | undefined | null) {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Public origin of this deployment, including the sub-path when there is one, never trailing-slashed. */
export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * App-absolute path → absolute URL, for sitemaps, canonical/openGraph metadata, certificate QR
 * codes and e-mail bodies.
 *
 * Joins by PREFIXING rather than with `new URL(path, base)`: relative resolution throws away
 * everything after the origin, so with APP_URL="https://eduskillindia.org/center" the old code
 * turned "/sitemap.xml" into "https://eduskillindia.org/sitemap.xml" — the existing, unrelated site.
 *
 *   BASE_PATH=""       APP_URL="http://localhost:3000"
 *     absoluteUrl("/about")            → "http://localhost:3000/about"
 *     absoluteUrl("/")                 → "http://localhost:3000/"
 *   BASE_PATH="/center" APP_URL="https://eduskillindia.org/center"
 *     absoluteUrl("/about")            → "https://eduskillindia.org/center/about"
 *     absoluteUrl("/center/api/files/x") → "https://eduskillindia.org/center/api/files/x"  (no double prefix)
 *   Values that are already URLs ("https://cdn/x", "data:…") are returned untouched.
 */
export function absoluteUrl(path: string) {
  if (!path) return appUrl() + "/";
  if (path.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(path)) return path;
  const base = appUrl();
  const rel = path.startsWith("/") ? path : `/${path}`;
  // APP_URL normally already carries the sub-path; if it does not, add it here so the URL is still right.
  const suffix = BASE_PATH && base.endsWith(BASE_PATH) ? stripBasePath(rel) : withBasePath(rel);
  return `${base}${suffix}`;
}

export function maskMobile(mobile: string | null | undefined) {
  if (!mobile) return "";
  return mobile.replace(/^(\d{2})\d+(\d{2})$/, "$1XXXXXX$2");
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * Human-readable file size for upload cards: `formatBytes(1536) === "1.5 KB"`, `formatBytes(157286400) === "150 MB"`.
 * Uses 1024-based units; drops the decimals once the number has three digits.
 */
export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  let exp = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  let value = bytes / 1024 ** exp;
  // 1048575 B would otherwise round up to "1024 KB"; roll over to the next unit instead.
  if (value >= 1023.5 && exp < BYTE_UNITS.length - 1) {
    exp += 1;
    value /= 1024;
  }
  const text = value.toFixed(value >= 100 ? 0 : digits).replace(/\.0+$/, "");
  return `${text} ${BYTE_UNITS[exp]}`;
}

export type Greeting = "Good Morning" | "Good Afternoon" | "Good Evening";

/**
 * Time-of-day greeting for portal home screens, evaluated in the given IANA time zone
 * (default India) so server and client agree: before 12:00 → Morning, before 17:00 → Afternoon.
 */
export function greeting(date: Date = new Date(), tz = "Asia/Kolkata"): Greeting {
  let hour: number;
  try {
    const part = new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: tz }).formatToParts(date).find((p) => p.type === "hour");
    hour = part ? Number(part.value) : date.getHours();
  } catch {
    hour = date.getHours();
  }
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}
