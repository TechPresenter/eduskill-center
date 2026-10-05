import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { VolunteerTeacherDeclaration } from "@/components/site/terms-declarations";
import { TermsPageView, termsPageMetadata } from "@/components/site/terms-page";

export function generateMetadata(): Promise<Metadata> {
  return termsPageMetadata("volunteerTeacher");
}

export const dynamic = "force-dynamic";

/** The Volunteer Teacher Terms & Conditions, accepted first on /become-a-trainer/apply and /become-a-trainer/teach. */
export default async function VolunteerTeacherTermsPage() {
  const open = await getSetting<boolean>("admissions.trainerApplicationsOpen").catch(() => true);
  return (
    <TermsPageView
      termsKey="volunteerTeacher"
      eyebrow="Become a Trainer"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Become a Trainer", href: "/become-a-trainer" }, { label: "Terms & Conditions" }]}
      declaration={<VolunteerTeacherDeclaration blank headingLevel={2} />}
      cta={
        open !== false
          ? { href: "/become-a-trainer/apply", label: "Apply as a volunteer trainer", note: "You accept these terms on the first step of the application, before the form opens." }
          : null
      }
    />
  );
}
