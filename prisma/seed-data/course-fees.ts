/**
 * Course fees set by the Foundation (October 2026), by course code:
 *
 *   Class 1–4 (Normal Education)            ₹50 registration fee only — no monthly fee
 *   Class 5–10 (School Education)           ₹100 a month
 *   Class 11–12 (Senior Secondary)          ₹300 a month
 *   Competitive Exam Training (EXAM-PREP)   ₹300 a month
 *
 * A registration-only course keeps `Course.courseFee` at 0 and charges `registrationFee`, so the
 * site prints "Registration fee ₹50" and an admission bills exactly that, once.
 *
 * A monthly course holds the monthly amount in `Course.courseFee`; an admission bills it once (the
 * site calls what admission collects the "registration fees"), and the rest is collected month by
 * month (or through an installment plan from Admin → Applications). A MONTHLY `CourseFeePlan`
 * with the same amount is what makes the site print "₹100 / month" instead of "₹100".
 *
 * Used when the catalogue is created (scripts/apply-shiksha-mission.ts,
 * scripts/apply-education-categories.ts) and to move an existing database onto these fees
 * (scripts/apply-monthly-fees.ts). After that, Admin → Courses is the place to change a fee.
 */
export const REGISTRATION_ONLY_FEES: Readonly<Record<string, number>> = {
  "CLASS-1": 50,
  "CLASS-2": 50,
  "CLASS-3": 50,
  "CLASS-4": 50,
};

export const MONTHLY_COURSE_FEES: Readonly<Record<string, number>> = {
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

/** The monthly fee for a catalogue course code, or 0 for a code that has no monthly fee. */
export function monthlyFeeFor(code: string): number {
  return MONTHLY_COURSE_FEES[code] ?? 0;
}

/** The one-time registration fee of a registration-only course code, or 0. */
export function registrationFeeFor(code: string): number {
  return REGISTRATION_ONLY_FEES[code] ?? 0;
}
