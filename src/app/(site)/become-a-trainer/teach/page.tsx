import type { Metadata } from "next";
import { Search } from "lucide-react";
import { getSetting } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { TeacherApplyForm } from "./teacher-form";

const TITLE = "Apply as a Teacher";
const DESCRIPTION = "A short application to teach with EduSkill India Foundation: your subjects, the classes you can take, your experience and your resume. Takes about two minutes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/become-a-trainer/teach") },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/become-a-trainer/teach"), type: "website" },
};

export const dynamic = "force-dynamic";

/**
 * The short teacher screening form. It sits under /become-a-trainer because it opens the SAME
 * TrainerApplication the 8-step wizard at /become-a-trainer/apply opens — one pipeline, one admin
 * queue, one status page at /become-a-trainer/status — and the URL should say so.
 */
export default async function TeacherApplyPage() {
  const open = await getSetting<boolean>("admissions.trainerApplicationsOpen").catch(() => true);

  return (
    <>
      <PageHero
        compact
        eyebrow="Teach with us"
        title="Apply as a [[Teacher]]"
        description="Tell us what you teach and attach your resume. That is all we need to start screening — about two minutes."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Become a Trainer", href: "/become-a-trainer" }, { label: "Apply as a Teacher" }]}
      >
        <ButtonLink href="/become-a-trainer/status" variant="white" leftIcon={<Search className="h-4 w-4" />}>
          Track an existing application
        </ButtonLink>
      </PageHero>

      <section className="bg-surface">
        <div className="container-x section-y">
          {open !== false ? (
            <TeacherApplyForm />
          ) : (
            <div className="mx-auto max-w-2xl">
              <Alert tone="warning" title="Teacher applications are currently closed">
                We are not accepting new applications at the moment. Please check back soon, or track an application you have already sent.
              </Alert>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/become-a-trainer/status" variant="navy">
                  Track my application
                </ButtonLink>
                <ButtonLink href="/become-a-trainer" variant="outline">
                  Back
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
