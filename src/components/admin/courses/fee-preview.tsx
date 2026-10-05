import { Badge } from "@/components/ui/badge";
import { formatMoney, type FeeDisplay } from "@/lib/course-pricing";
import { cn } from "@/lib/utils";

/**
 * What the public course page will print, rendered from a `FeeDisplay` and nothing else.
 *
 * Every string here — `priceText`, `text`, `discountPercent`, `originalAmount` — is produced by
 * `formatCourseFee()` in `src/lib/course-pricing.ts`. There is no formatting logic in this file, so
 * the admin preview cannot disagree with the site. `formatMoney` is that module's own helper.
 */
export function FeePreview({ fee, offerTitle, className }: { fee: FeeDisplay; offerTitle?: string | null; className?: string }) {
  return (
    <div className={cn("rounded-card border border-line bg-surface p-4 sm:p-5", className)}>
      <p className="text-caption font-semibold tracking-wide text-muted uppercase">Public page preview</p>

      <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
        {fee.originalAmount != null && <span className="text-body-sm text-muted line-through tabular-nums">{formatMoney(fee.originalAmount, fee.currency)}</span>}
        <span className={cn("font-heading text-h3 leading-none", fee.isFree ? "text-success-dark" : "text-navy")}>{fee.isFree ? fee.priceText : fee.amount != null ? formatMoney(fee.amount, fee.currency) : fee.priceText}</span>
        {fee.suffix && <span className="text-body-sm font-semibold text-muted">{fee.suffix}</span>}
        {fee.discountPercent != null && fee.discountPercent > 0 && <Badge tone="success">{fee.discountPercent}% off</Badge>}
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-body-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Shown as</dt>
          <dd className="text-right font-medium text-ink">{fee.label}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Price line</dt>
          <dd className="text-right font-medium text-ink">{fee.priceText}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Full label</dt>
          <dd className="text-right font-medium text-ink">{fee.text}</dd>
        </div>
        {fee.enrolmentFee > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Enrolment fee</dt>
            <dd className="text-right tabular-nums">{formatMoney(fee.enrolmentFee, fee.currency)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Payment</dt>
          <dd className="text-right font-medium text-ink">{fee.isFree ? "Nothing payable up front" : fee.paymentRequired ? "Required to confirm the seat" : "Collected later, not at enrolment"}</dd>
        </div>
      </dl>

      {offerTitle && (
        <p className="mt-3 text-caption text-muted">
          Includes the live offer <span className="font-semibold text-ink">{offerTitle}</span>.
        </p>
      )}
    </div>
  );
}
