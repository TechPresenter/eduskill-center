import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { InChargeDeclaration } from "@/components/site/terms-declarations";
import { TermsPageView, termsPageMetadata } from "@/components/site/terms-page";

export function generateMetadata(): Promise<Metadata> {
  return termsPageMetadata("inCharge");
}

export const dynamic = "force-dynamic";

/** The Block / District In-Charge terms, accepted on the Level step by Block and District level applicants. */
export default async function InChargeTermsPage() {
  const open = await getSetting<boolean>("admissions.trainerApplicationsOpen").catch(() => true);
  return (
    <TermsPageView
      termsKey="inCharge"
      eyebrow="Become a Trainer · Block & District In-Charge"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Become a Trainer", href: "/become-a-trainer" }, { label: "In-Charge Terms" }]}
      declaration={<InChargeDeclaration blank headingLevel={2} />}
      cta={
        open !== false
          ? {
              href: "/become-a-trainer/apply",
              label: "Apply as a volunteer trainer",
              note: "Block and District level applicants accept these terms on the Level step, as well as the Volunteer Teacher terms.",
            }
          : null
      }
    />
  );
}
