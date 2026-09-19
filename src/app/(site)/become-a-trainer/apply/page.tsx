import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
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
      <section className="bg-navy text-white">
        <div className="container-x py-12 sm:py-16">
          <p className="eyebrow text-orange">Volunteer with us</p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold text-white sm:text-4xl">Become a Volunteer Trainer</h1>
          <p className="mt-3 max-w-2xl text-white/80">
            Share your skills with learners in your block, district or state. The application takes about ten minutes — you can upload your documents right after
            submitting, or later from the{" "}
            <Link href="/become-a-trainer/status" className="font-semibold text-white underline underline-offset-4">
              application status page
            </Link>
            .
          </p>
        </div>
      </section>
      <section className="bg-surface">
        <div className="container-x py-10 sm:py-14">
          {open ? (
            <TrainerApplyForm documentTypes={documentTypes} />
          ) : (
            <div className="mx-auto max-w-2xl">
              <Alert tone="warning" title="Volunteer trainer applications are currently closed">
                We are not accepting new volunteer trainer applications at the moment. Please check back soon or track an existing application.
              </Alert>
              <div className="mt-6 flex flex-wrap gap-3">
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
