import type { Metadata } from "next";
import { Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
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
      <PageHero
        compact
        eyebrow="EduSkill Shiksha Mission"
        title="Apply to open a [[Normal Education Centre]]"
        description="Class 1 to 4 — regular study, practice and extra academic support for children in your area. The form takes about ten minutes, and you can upload your documents right after submitting or later, from the status page."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Open a Centre", href: "/open-a-centre" }, { label: "Apply" }]}
      >
        <ButtonLink href="/open-a-centre/status" variant="white" leftIcon={<Search className="h-4 w-4" />}>
          Track an existing application
        </ButtonLink>
      </PageHero>

      <section className="bg-surface">
        <div className="container-x section-y">
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
