/**
 * The Terms & Conditions documents applicants read and accept before they apply. Each one's live
 * text is an editable CMS page (Admin → CMS → Pages, `slug`); its built-in text, which seeds the
 * page and stands in for it while it is missing or a Draft, is in `./defaults`. What an applicant
 * accepted is kept verbatim in `TermsVersion` (see `src/server/terms.ts`).
 *
 * Client-safe and tiny on purpose: forms import it for the slugs and paths, so the long default
 * texts never ride along into a client bundle.
 */
export const TERMS_DOCUMENTS = {
  /** Everyone who applies to open a Class 1–4 centre (/open-a-centre/apply). */
  centreInCharge: { slug: "centre-in-charge-terms", path: "/open-a-centre/terms", label: "Centre In-charge Terms & Conditions" },
  /** Everyone who applies as a volunteer trainer or teacher (/become-a-trainer/apply and /teach). */
  volunteerTeacher: { slug: "volunteer-teacher-terms", path: "/become-a-trainer/terms", label: "Volunteer Teacher Terms & Conditions" },
  /** Block- and District-level volunteer trainer applicants, on the wizard's Level step. */
  inCharge: { slug: "district-in-charge-terms", path: "/become-a-trainer/in-charge-terms", label: "Block / District In-Charge Terms" },
} as const;

export type TermsKey = keyof typeof TERMS_DOCUMENTS;

export const TERMS_KEYS = Object.keys(TERMS_DOCUMENTS) as TermsKey[];

/** The terms document a CMS page slug belongs to, if any. */
export function termsKeyForSlug(slug: string): TermsKey | null {
  return TERMS_KEYS.find((k) => TERMS_DOCUMENTS[k].slug === slug) ?? null;
}

/** Block and District level volunteers are the Foundation's In-Charges and accept those terms too. */
export const IN_CHARGE_LEVELS = ["BLOCK", "DISTRICT"] as const;

export function levelNeedsInChargeTerms(level: string | null | undefined): boolean {
  return (IN_CHARGE_LEVELS as readonly string[]).includes(level ?? "");
}
