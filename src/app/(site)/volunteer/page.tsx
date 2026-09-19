import type { Metadata } from "next";
import { CmsPageView, cmsPageMetadata } from "@/components/site/cms-page";
import { CtaBand } from "@/components/site/cta-band";

export function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata("volunteer", "/volunteer", "Volunteer With Us");
}

export default function VolunteerPage() {
  return (
    <>
      <CmsPageView slug="volunteer" eyebrow="Volunteer" fallbackTitle="Volunteer With Us" />
      <CtaBand title="Ready to [[volunteer]]?" description="Apply as a volunteer trainer at block, district or state level, or write to us about other ways to help." primary={{ label: "Apply as a Trainer", href: "/become-a-trainer/apply" }} secondary={{ label: "Contact Us", href: "/contact?type=VOLUNTEER" }} />
    </>
  );
}
