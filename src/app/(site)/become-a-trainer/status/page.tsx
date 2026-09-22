import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { TrainerStatusForm } from "./status-form";

export const metadata: Metadata = {
  title: "Volunteer Trainer Application Status",
  description: "Track your EduSkill volunteer trainer application using your application number and registered mobile number.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function TrainerStatusPage({ searchParams }: PageProps<"/become-a-trainer/status">) {
  const sp = await searchParams;
  const no = typeof sp.no === "string" ? sp.no : "";
  const documentTypes = await db.documentType.findMany({ where: { appliesTo: "TRAINER", isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { key: true, name: true, description: true, isRequired: true } });
  return (
    <>
      <PageHero
        compact
        eyebrow="Volunteer trainers"
        title="Track your [[application]]"
        description="Enter your application number and the mobile number you registered with to see exactly where your application stands."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Become a Trainer", href: "/become-a-trainer" }, { label: "Application status" }]}
      >
        <ButtonLink href="/become-a-trainer/apply" variant="white" rightIcon={<ArrowRight className="h-4 w-4" />}>
          Not applied yet? Apply now
        </ButtonLink>
      </PageHero>

      <section className="bg-surface">
        <div className="container-x section-y">
          <TrainerStatusForm initialNo={no} documentTypes={documentTypes} />
        </div>
      </section>
    </>
  );
}
