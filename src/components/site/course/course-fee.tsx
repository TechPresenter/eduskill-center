import Link from "next/link";
import { ArrowRight, BadgePercent, MapPin, Tag, Wallet } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Media } from "@/components/site/safe-image";
import { Markdown } from "@/components/site/markdown";
import { CourseGallery, type CourseGalleryImage } from "@/components/site/course/course-gallery";
import { formatMoney, type FeeDisplay } from "@/lib/course-pricing";
import { formatDate } from "@/lib/utils";

export interface CourseOfferView {
  title: string;
  description: string | null;
  couponCode: string | null;
  endsAt: Date | null;
  bannerSrc: string | null;
}

export interface FeeBreakdownRow {
  label: string;
  value: number;
}

/**
 * Fee / Offer.
 *
 * Every string on this card comes out of `formatCourseFee()` in src/lib/course-pricing.ts — the one
 * formatter the admin preview also renders through, so the site and the admin panel cannot disagree
 * about a price. Amounts that are not the headline (the enrolment fee, the legacy breakdown) use
 * that module's `formatMoney()`. Nothing here formats money itself.
 *
 * The offer passed in is already the *effective* one: `getEffectiveOffer()` filters the window in
 * SQL, so an offer that has not started or has ended never arrives here and there is no date
 * comparison in this component to get wrong.
 *
 * `breakdown` lists the other fees admission bills: for a course with no `CourseFeePlan`, every
 * billed line (adding up to `total`); with a plan, the one-time exam and certificate fees the plan
 * has no field for.
 */
export function CourseFee({
  fee,
  offer,
  planNote,
  breakdown,
  total,
  scholarshipNote,
  applyHref,
  centersHref,
  promotional,
  seed,
}: {
  fee: FeeDisplay;
  offer: CourseOfferView | null;
  planNote: string | null;
  breakdown: FeeBreakdownRow[];
  /** Sum of the headline and the breakdown rows, when there are breakdown rows to sum. */
  total: number | null;
  scholarshipNote: string | null;
  applyHref: string;
  centersHref: string;
  promotional: CourseGalleryImage[];
  seed: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="card overflow-hidden lg:col-span-7">
          <div className="flex items-center gap-3 bg-navy px-5 py-4 text-white sm:px-6">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10">
              <Wallet className="h-5 w-5" />
            </span>
            <h3 className="text-h4 text-white">What it costs</h3>
            {fee.discountPercent != null && fee.discountPercent > 0 && (
              <span className="ml-auto shrink-0 rounded-full bg-orange px-3 py-1 text-caption font-bold text-white tabular-nums">{fee.discountPercent}% off</span>
            )}
          </div>
          <div className="card-p">
            {/* What the price is ("Course fee", "Monthly fee", "Registration fee"), then one text node
                straight from FeeDisplay: "No fee", "₹999", "₹1,999 → ₹999". */}
            <p className="text-overline text-muted">{fee.label}</p>
            <p className="mt-1 text-h1 text-navy tabular-nums">{fee.priceText}</p>
            {fee.suffix && <p className="mt-1 text-body-lg font-semibold text-muted">{fee.suffix}</p>}

            {(fee.enrolmentFee > 0 || breakdown.length > 0 || total != null) && (
              <dl className="mt-4 space-y-2 border-t border-line pt-4 text-body">
                {fee.enrolmentFee > 0 && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">One-time enrolment fee</dt>
                    <dd className="font-semibold text-ink tabular-nums">{formatMoney(fee.enrolmentFee, fee.currency)}</dd>
                  </div>
                )}
                {breakdown.map((r) => (
                  <div key={r.label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">{r.label}</dt>
                    <dd className="font-semibold text-ink tabular-nums">{formatMoney(r.value, fee.currency)}</dd>
                  </div>
                ))}
                {total != null && (
                  <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                    <dt className="font-bold text-navy">Total payable</dt>
                    <dd className="text-h4 text-navy tabular-nums">{formatMoney(total, fee.currency)}</dd>
                  </div>
                )}
              </dl>
            )}

            {!fee.paymentRequired && !fee.isFree && (
              <p className="mt-4 rounded-card bg-lavender p-3 text-body-sm text-ink">
                No payment is needed to apply — our team confirms the amount and how to pay it during admission.
              </p>
            )}
            {planNote && <p className="mt-4 text-body-sm text-muted">{planNote}</p>}

            {scholarshipNote && (
              <div className="mt-4 rounded-card bg-orange-light p-4">
                <Badge tone="orange" className="mb-2">
                  Scholarship available
                </Badge>
                <p className="text-body-sm text-ink">{scholarshipNote}</p>
                <Link href="/scholarship" className="ring-focus mt-2 inline-flex min-h-11 items-center text-body-sm font-semibold text-orange hover:underline">
                  Check eligibility →
                </Link>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={applyHref} size="lg" fullWidth rightIcon={<ArrowRight className="h-4 w-4" />}>
                Enrol Now
              </ButtonLink>
              <ButtonLink href={centersHref} size="lg" variant="outline" fullWidth leftIcon={<MapPin className="h-4 w-4" />}>
                Find a Center
              </ButtonLink>
            </div>
          </div>
        </div>

        {offer && (
          <aside className="card overflow-hidden lg:col-span-5" aria-label="Current offer">
            {offer.bannerSrc && <Media src={offer.bannerSrc} alt={offer.title} seed={`${seed}-offer`} ratio="16x9" sizes="(max-width: 1024px) 100vw, 420px" />}
            <div className="card-p">
              <p className="eyebrow mb-2 flex items-center gap-1.5">
                <BadgePercent className="h-4 w-4" aria-hidden /> Limited offer
              </p>
              <h3 className="text-h3 text-navy">{offer.title}</h3>
              {offer.description && <Markdown source={offer.description} className="mt-2 text-body" />}
              {offer.couponCode && (
                <p className="mt-4 flex flex-wrap items-center gap-2 text-body-sm">
                  <span className="flex items-center gap-1.5 text-muted">
                    <Tag className="h-4 w-4" aria-hidden /> Offer code
                  </span>
                  <code className="rounded-md border border-dashed border-orange bg-orange-light px-2.5 py-1 font-mono text-body-sm font-bold tracking-wider text-orange">
                    {offer.couponCode}
                  </code>
                </p>
              )}
              {offer.endsAt && <p className="mt-3 text-body-sm font-semibold text-ink">Valid until {formatDate(offer.endsAt)}</p>}
            </div>
          </aside>
        )}
      </div>

      <CourseGallery images={promotional} seed={seed} label="Offer and announcement images" />
    </div>
  );
}
