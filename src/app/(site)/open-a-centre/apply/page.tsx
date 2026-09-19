import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { getSetting } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { CENTRE_CLASSES, SPACE_TYPES } from "@/lib/validation/centre-applications";
import { CENTRE_STEPS } from "@/server/centre-applications";
import { CentreApplyForm } from "./apply-form";

const TITLE = "Apply to Open a Centre";
const DESCRIPTION =
  "Apply to open an EduSkill Normal Education Centre for Class 1 to 4 in your panchayat, village or town. Fill the form in five short steps and upload your documents straight after submitting.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: absoluteUrl("/open-a-centre/apply") },
    openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/open-a-centre/apply"), type: "website" },
  };
}

export const dynamic = "force-dynamic";

export default async function OpenACentreApplyPage() {
  const open = await getSetting<boolean>("centres.applicationsOpen").catch(() => true);

  return (
    <>
      <section className="bg-navy text-white">
        <div className="container-x py-10 sm:py-14">
          <div>
            <Link href="/open-a-centre" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Open a Centre
            </Link>
          </div>
          <p className="eyebrow mt-2 text-orange">EduSkill Shiksha Mission</p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold text-white sm:text-4xl">Apply to open a Normal Education Centre</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/80">
            Class 1 to 4 — regular study, practice and extra academic support for children in your area. The form takes about ten minutes. You can upload your documents right after
            submitting, or later from the{" "}
            <Link href="/open-a-centre/status" className="font-semibold text-white underline underline-offset-4">
              application status page
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="bg-surface">
        <div className="container-x py-8 sm:py-12">
          {open !== false ? (
            <CentreApplyForm steps={CENTRE_STEPS} classes={CENTRE_CLASSES} spaceTypes={SPACE_TYPES} />
          ) : (
            <div className="mx-auto max-w-2xl">
              <Alert tone="warning" title="Centre applications are currently closed">
                We are not accepting new applications to open a Normal Education Centre at the moment. Please check back soon, or track an application you have already submitted.
              </Alert>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/open-a-centre/status" variant="navy">
                  Track my application
                </ButtonLink>
                <ButtonLink href="/open-a-centre" variant="outline">
                  Back to Open a Centre
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
