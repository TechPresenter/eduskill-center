import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { absoluteUrl } from "@/lib/utils";
import { CENTRE_CLASSES } from "@/lib/validation/centre-applications";
import { CENTRE_STEPS } from "@/server/centre-applications";
import { CentreStatusForm } from "./status-form";

const TITLE = "Centre Application Status";
const DESCRIPTION =
  "Track your EduSkill Normal Education Centre application through all seven steps using your application number and registered mobile number.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    robots: { index: false },
    alternates: { canonical: absoluteUrl("/open-a-centre/status") },
    openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/open-a-centre/status"), type: "website" },
  };
}

export const dynamic = "force-dynamic";

export default async function OpenACentreStatusPage({ searchParams }: PageProps<"/open-a-centre/status">) {
  const sp = await searchParams;
  const no = typeof sp.no === "string" ? sp.no : "";

  return (
    <>
      <PageHero
        compact
        eyebrow="EduSkill Shiksha Mission"
        title="Track your [[centre application]]"
        description="Enter your application number and the mobile number you applied with to see where you are in the seven-step process."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Open a Centre", href: "/open-a-centre" }, { label: "Application status" }]}
      >
        <ButtonLink href="/open-a-centre/apply" variant="white" rightIcon={<ArrowRight className="h-4 w-4" />}>
          Not applied yet? Apply now
        </ButtonLink>
      </PageHero>

      <section className="bg-surface">
        <div className="container-x section-y">
          <CentreStatusForm initialNo={no} steps={CENTRE_STEPS} classes={CENTRE_CLASSES} />
        </div>
      </section>
    </>
  );
}
