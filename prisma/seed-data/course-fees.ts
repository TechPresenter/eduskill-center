/**
 * Monthly course fees set by the Foundation (October 2026), by course code:
 *
 *   Class 1–4 (Normal Education)            ₹50 a month
 *   Class 5–10 (School Education)           ₹100 a month
 *   Class 11–12 (Senior Secondary)          ₹300 a month
 *   Competitive Exam Training (EXAM-PREP)   ₹300 a month
 *
 * `Course.courseFee` holds the monthly amount, so an admission bills the first month; the rest is
 * collected month by month (or through an installment plan from Admin → Applications). A MONTHLY
 * `CourseFeePlan` with the same amount is what makes the site print "₹50 / month" instead of "₹50".
 *
 * Used when the catalogue is created (scripts/apply-shiksha-mission.ts,
 * scripts/apply-education-categories.ts) and to move an existing database onto these fees
 * (scripts/apply-monthly-fees.ts). After that, Admin → Courses is the place to change a fee.
 */
export const MONTHLY_COURSE_FEES: Readonly<Record<string, number>> = {
  "CLASS-1": 50,
  "CLASS-2": 50,
  "CLASS-3": 50,
  "CLASS-4": 50,
  "CLASS-5": 100,
  "CLASS-6": 100,
  "CLASS-7": 100,
  "CLASS-8": 100,
  "CLASS-9": 100,
  "CLASS-10": 100,
  "CLASS-11": 300,
  "CLASS-12": 300,
  "EXAM-PREP": 300,
};

/** The monthly fee for a catalogue course code, or 0 for a code the Foundation has not priced. */
export function monthlyFeeFor(code: string): number {
  return MONTHLY_COURSE_FEES[code] ?? 0;
}
