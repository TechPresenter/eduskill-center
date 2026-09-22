import type { Metadata } from "next";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { TrainerApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Apply as a Volunteer Trainer",
  description: "Apply to become a block, district or state level volunteer trainer with EduSkill India Foundation.",
};

export const dynamic = "force-dynamic";

export default async function TrainerApplyPage() {
  const [open, documentTypes] = await Promise.all([
    getSetting<boolean>("admissions.trainerApplicationsOpen"),
    db.documentType.findMany({ where: { appliesTo: "TRAINER", isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { key: true, name: true, description: true, isRequired: true } }),
  ]);

  return (
    <>
      <PageHero
        compact
        eyebrow="Volunteer with us"
        title="Become a [[Volunteer Trainer]]"
        description="Share your skills with learners in your block, district or state. The application takes about ten minutes, and you can upload your documents right after submitting — or later, from the status page."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Become a Trainer", href: "/become-a-trainer" }, { label: "Apply" }]}
      >
        <ButtonLink href="/become-a-trainer/status" variant="white" leftIcon={<Search className="h-4 w-4" />}>
          Track an existing application
        </ButtonLink>
      </PageHero>

      <section className="bg-surface">
        <div className="container-x section-y">
          {open ? (
            <TrainerApplyForm documentTypes={documentTypes} />
          ) : (
            <div className="mx-auto max-w-2xl">
              <Alert tone="warning" title="Volunteer trainer applications are currently closed">
                We are not accepting new volunteer trainer applications at the moment. Please check back soon or track an existing application.
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
