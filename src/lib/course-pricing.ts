/**
 * Pure course pricing / offer logic — no database, no `server-only`, safe to import from client
 * components. The public course page, the course cards and the admin preview all render fees
 * through `formatCourseFee()`, so the two surfaces cannot drift apart.
 *
 * Nothing here touches the transactional fee columns (`Course.courseFee`, `registrationFee`,
 * `examFee`, `certificateFee`). Those remain the single source of truth for what a student is
 * actually billed; `CourseFeePlan` only decides how the price is *presented*.
 */
import type { CourseFeeType } from "@/generated/prisma/enums";

// ───────────────────────────── Types ─────────────────────────────

/** A `CourseFeePlan` row with its Decimals already converted to numbers. */
export interface FeePlanLike {
  feeType: CourseFeeType;
  currency?: string | null;
  /** For MONTHLY this is the per-month amount. Ignored when feeType is FREE or CUSTOM. */
  baseFee: number;
  discountedFee?: number | null;
  offerPrice?: number | null;
  enrolmentFee?: number | null;
  paymentRequired?: boolean | null;
  customLabel?: string | null;
}

/** A live `CourseOffer` reduced to the three numbers that can move the displayed price. */
export interface OfferPricing {
  offerPrice?: number | null;
  originalPrice?: number | null;
  discountPercent?: number | null;
}

export interface FeeDisplay {
  feeType: CourseFeeType;
  currency: string;
  /** True when nothing is payable up front — feeType FREE, or an effective amount of zero. */
  isFree: boolean;
  /** Mirrors `CourseFeePlan.paymentRequired`; "pay later" is not the same as free. */
  paymentRequired: boolean;
  /** Effective payable amount. `null` for CUSTOM, where `customLabel` is the whole story. */
  amount: number | null;
  /** The struck-through "before" price. `null` when there is no discount. */
  originalAmount: number | null;
  /** Whole-percent saving, derived from the two numbers above so it can never contradict them. */
  discountPercent: number | null;
  /** "One Time" | "/ Month" | null */
  suffix: string | null;
  enrolmentFee: number;
  /** Just the price: "No fee", "₹999", "₹1,999 → ₹999", or the custom label. */
  priceText: string;
  /** The full label: "No fee", "₹999 One Time", "₹499 / Month", "₹1,999 → ₹999 One Time". */
  text: string;
  /** What the headline price is called: "Course fee", "Monthly fee", "Registration fee", "Fees", "Fee" or "Cost". */
  label: string;
}

/** Printed for a course with nothing payable. Deliberately not "Free": the site never advertises free training. */
export const FREE_LABEL = "No fee";
export const CUSTOM_FALLBACK_LABEL = "Custom pricing";

// ───────────────────────────── Money formatting ─────────────────────────────

const formatters = new Map<string, Intl.NumberFormat>();

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** `₹999` / `₹1,999` / `₹1,999.50`. Decimals appear only when the amount actually has paise. */
export function formatMoney(value: number, currency = "INR"): string {
  const v = round2(value);
  const decimals = Number.isInteger(v) ? 0 : 2;
  const code = (currency || "INR").toUpperCase();
  const key = `${code}:${decimals}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-IN", { style: "currency", currency: code, minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } catch {
      f = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    formatters.set(key, f);
  }
  return f.format(v);
}

// ───────────────────────────── The one fee formatter ─────────────────────────────

/**
 * Turns a fee plan (plus the currently-effective offer, if any) into everything a UI needs to
 * render a price. Pure: same inputs, same output, no clock and no database.
 *
 * Precedence for the payable amount, lowest wins: offer price → plan offer price →
 * plan discounted fee → base fee. A "discount" above the base fee is ignored rather than shown,
 * so bad data degrades to the plain base price instead of an insulting markup.
 */
export function formatCourseFee(plan: FeePlanLike | null | undefined, offer?: OfferPricing | null): FeeDisplay {
  const p: FeePlanLike = plan ?? { feeType: "FREE", baseFee: 0 };
  const currency = (p.currency || "INR").toUpperCase();
  const paymentRequired = p.paymentRequired ?? true;
  const enrolmentFee = round2(num(p.enrolmentFee));
  const base = round2(num(p.baseFee));

  if (p.feeType === "CUSTOM") {
    const label = (p.customLabel ?? "").trim() || CUSTOM_FALLBACK_LABEL;
    return { feeType: "CUSTOM", currency, isFree: false, paymentRequired, amount: null, originalAmount: null, discountPercent: null, suffix: null, enrolmentFee, priceText: label, text: label, label: "Fee" };
  }

  if (p.feeType === "FREE") {
    return { feeType: "FREE", currency, isFree: true, paymentRequired: false, amount: 0, originalAmount: null, discountPercent: null, suffix: null, enrolmentFee, priceText: FREE_LABEL, text: FREE_LABEL, label: "Cost" };
  }

  const candidates: number[] = [];
  if (offer?.offerPrice != null) candidates.push(round2(offer.offerPrice));
  else if (offer?.discountPercent != null && offer.discountPercent > 0 && offer.discountPercent <= 100) {
    candidates.push(round2(base * (1 - offer.discountPercent / 100)));
  }
  if (p.offerPrice != null) candidates.push(round2(p.offerPrice));
  if (p.discountedFee != null) candidates.push(round2(p.discountedFee));

  const lowest = candidates.length ? Math.min(...candidates) : base;
  const amount = Math.max(0, Math.min(lowest, base));

  const declaredOriginal = offer?.originalPrice != null ? round2(offer.originalPrice) : null;
  const originalAmount = declaredOriginal != null && declaredOriginal > amount ? declaredOriginal : base > amount ? base : null;
  const discountPercent = originalAmount && originalAmount > 0 ? Math.round(((originalAmount - amount) / originalAmount) * 100) : null;

  const isFree = amount === 0;
  const suffix = p.feeType === "MONTHLY" ? "/ Month" : "One Time";

  if (isFree) {
    return { feeType: p.feeType, currency, isFree: true, paymentRequired: false, amount: 0, originalAmount, discountPercent, suffix: null, enrolmentFee, priceText: FREE_LABEL, text: FREE_LABEL, label: "Cost" };
  }

  const priceText = originalAmount != null ? `${formatMoney(originalAmount, currency)} → ${formatMoney(amount, currency)}` : formatMoney(amount, currency);
  return { feeType: p.feeType, currency, isFree: false, paymentRequired, amount, originalAmount, discountPercent, suffix, enrolmentFee, priceText, text: `${priceText} ${suffix}`, label: p.feeType === "MONTHLY" ? "Monthly fee" : "Course fee" };
}

/**
 * The fallback plan for a course that has no `CourseFeePlan` row yet — i.e. every course that
 * existed before the Course CMS shipped. Derived, never written: no backfill, no migration of
 * data, and the public page renders exactly what it rendered before.
 */
export function feePlanFromCourse(course: { courseFee: number; registrationFee?: number | null }): FeePlanLike {
  const baseFee = round2(num(course.courseFee));
  return {
    feeType: baseFee > 0 ? "ONE_TIME" : "FREE",
    currency: "INR",
    baseFee,
    enrolmentFee: round2(num(course.registrationFee)),
    paymentRequired: baseFee > 0,
  };
}

/**
 * The price of a course with NO fee plan: exactly what admission bills, from the course's own fee
 * columns (`computeFeeLines` in src/server/applications.ts), headlined the way the course cards and
 * the earlier course page do it (`feeHeadline`). A course whose only charge is a registration fee —
 * Class 1–4: no course fee, a ₹50 registration fee — reads "Registration fee ₹50", never "No fee".
 * Only a course that bills nothing at all is FREE.
 */
export function feeDisplayFromCourse(
  c: { courseFee: number; registrationFee?: number | null; examFee?: number | null; certificateFee?: number | null },
  currency = "INR"
): FeeDisplay {
  const h = feeHeadline(c, currency);
  if (h.kind === "none") return formatCourseFee({ feeType: "FREE", currency, baseFee: 0 });
  if (h.kind === "course") return formatCourseFee({ feeType: "ONE_TIME", currency, baseFee: h.amount, enrolmentFee: 0, paymentRequired: true });
  const priceText = formatMoney(h.amount, currency);
  return { feeType: "ONE_TIME", currency, isFree: false, paymentRequired: true, amount: h.amount, originalAmount: null, discountPercent: null, suffix: null, enrolmentFee: 0, priceText, text: priceText, label: h.label };
}

// ───────────────────────────── Fee period ─────────────────────────────

/**
 * How often `Course.courseFee` is charged. `"month"` when the course's `CourseFeePlan` is MONTHLY
 * (Class 5 and above, and competitive exams), `null` for a one-time fee or a course without a plan.
 * The admission bills `courseFee` once (shown as the registration fees), so this only changes labels.
 */
export type FeePeriod = "month" | null;

export function feePeriodOf(plan: { feeType: CourseFeeType | string; deletedAt?: Date | string | null } | null | undefined): FeePeriod {
  return plan && !plan.deletedAt && plan.feeType === "MONTHLY" ? "month" : null;
}

/** " / month" for a monthly fee, "" otherwise — appended to a formatted amount. */
export function feePeriodSuffix(period: FeePeriod): string {
  return period === "month" ? " / month" : "";
}

/** "₹50 / month", "₹2,500", or FREE_LABEL when nothing is charged. */
export function formatFeeAmount(amount: number, period: FeePeriod, currency = "INR"): string {
  const v = round2(num(amount));
  return v > 0 ? `${formatMoney(v, currency)}${feePeriodSuffix(period)}` : FREE_LABEL;
}

/** What admission collects on a monthly or registration-only course, as the Foundation names it. */
export const ADMISSION_FEE_LABEL = "Registration fees";

export type FeeHeadlineKind = "monthly" | "course" | "registration" | "total" | "none";

/** The one fee line a card, a list row or a sticky bar shows for a course. */
export interface FeeHeadline {
  kind: FeeHeadlineKind;
  /** "Monthly fee" | "Course fee" | "Registration fee" | "Fees" */
  label: string;
  amount: number;
  /** " / month" for a monthly fee, "" otherwise. */
  suffix: string;
  /** "₹100 / month", "₹2,500", "₹50", or FREE_LABEL. */
  text: string;
}

/**
 * Picks the line that answers "what does this course cost?":
 *  - a monthly course fee → "₹100 / month" (Class 5 and above),
 *  - a one-time course fee → "₹2,500",
 *  - only a registration fee → "₹50", labelled "Registration fee" (Class 1–4: no monthly fee),
 *  - anything else that adds up → the total, labelled "Fees",
 *  - nothing at all → FREE_LABEL.
 */
export function feeHeadline(
  c: { courseFee: number; registrationFee?: number | null; examFee?: number | null; certificateFee?: number | null; feePeriod?: FeePeriod },
  currency = "INR"
): FeeHeadline {
  const course = round2(num(c.courseFee));
  const registration = round2(num(c.registrationFee));
  const total = round2(course + registration + num(c.examFee) + num(c.certificateFee));
  if (course > 0 && c.feePeriod === "month") return { kind: "monthly", label: "Monthly fee", amount: course, suffix: " / month", text: `${formatMoney(course, currency)} / month` };
  if (course > 0) return { kind: "course", label: "Course fee", amount: course, suffix: "", text: formatMoney(course, currency) };
  if (registration > 0 && registration === total) return { kind: "registration", label: "Registration fee", amount: registration, suffix: "", text: formatMoney(registration, currency) };
  if (total > 0) return { kind: "total", label: "Fees", amount: total, suffix: "", text: formatMoney(total, currency) };
  return { kind: "none", label: "Course fee", amount: 0, suffix: "", text: FREE_LABEL };
}

// ───────────────────────────── Offer windows ─────────────────────────────

export interface OfferWindow {
  isActive: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  deletedAt?: Date | string | null;
}

function time(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Whether an offer is live *right now*. `startsAt`/`endsAt` are inclusive bounds and `null` means
 * "unbounded". Expiry is decided here and in the equivalent SQL predicate — never by a cron job
 * and never by a flag a human has to remember to flip.
 */
export function isOfferEffective(offer: OfferWindow, now: Date = new Date()): boolean {
  if (!offer.isActive) return false;
  if (offer.deletedAt) return false;
  const t = now.getTime();
  const start = time(offer.startsAt);
  const end = time(offer.endsAt);
  if (start !== null && t < start) return false;
  if (end !== null && t > end) return false;
  return true;
}

/** The single offer a page should show: lowest `sortOrder` among the live ones, newest as tiebreak. */
export function pickEffectiveOffer<T extends OfferWindow & { sortOrder?: number; createdAt?: Date | string | null }>(
  offers: readonly T[],
  now: Date = new Date()
): T | null {
  const live = offers.filter((o) => isOfferEffective(o, now));
  if (!live.length) return null;
  return live
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (time(b.createdAt) ?? 0) - (time(a.createdAt) ?? 0))[0];
}
