import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <section className="bg-navy text-white">
        <div className="container-x py-10 sm:py-14">
          <div>
            <Link href="/open-a-centre" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Open a Centre
            </Link>
          </div>
          <p className="eyebrow mt-2 text-orange">EduSkill Shiksha Mission</p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold text-white sm:text-4xl">Track your centre application</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/80">
            Enter your application number and the mobile number you applied with to see where you are in the seven-step process. Not applied yet?{" "}
            <Link href="/open-a-centre/apply" className="font-semibold text-white underline underline-offset-4">
              Apply to open a centre
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="bg-surface">
        <div className="container-x py-8 sm:py-12">
          <CentreStatusForm initialNo={no} steps={CENTRE_STEPS} classes={CENTRE_CLASSES} />
        </div>
      </section>
    </>
  );
}
