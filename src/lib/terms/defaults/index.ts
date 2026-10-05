import type { TermsKey } from "@/lib/terms/documents";
import { CENTRE_IN_CHARGE_TERMS } from "./centre-in-charge";
import { IN_CHARGE_TERMS } from "./in-charge";
import { VOLUNTEER_TEACHER_TERMS } from "./volunteer-teacher";

export interface DefaultTerms {
  title: string;
  excerpt: string;
  content: string;
}

/**
 * Built-in text of each terms document: seeds its CMS page (prisma/seed-data/content.ts and the
 * migration that created the pages) and stands in for the page while it is missing or a Draft.
 * Server-side only in practice — the texts are long.
 */
export const DEFAULT_TERMS = {
  centreInCharge: CENTRE_IN_CHARGE_TERMS,
  volunteerTeacher: VOLUNTEER_TEACHER_TERMS,
  inCharge: IN_CHARGE_TERMS,
} satisfies Record<TermsKey, DefaultTerms>;
