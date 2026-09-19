import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
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
      <section className="bg-navy text-white">
        <div className="container-x py-12 sm:py-16">
          <p className="eyebrow text-orange">Volunteer trainers</p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold text-white sm:text-4xl">Track your application</h1>
          <p className="mt-3 max-w-2xl text-white/80">
            Enter your application number and the mobile number you registered with. Not applied yet?{" "}
            <Link href="/become-a-trainer/apply" className="font-semibold text-white underline underline-offset-4">
              Apply to become a volunteer trainer
            </Link>
            .
          </p>
        </div>
      </section>
      <section className="bg-surface">
        <div className="container-x py-10 sm:py-14">
          <TrainerStatusForm initialNo={no} documentTypes={documentTypes} />
        </div>
      </section>
    </>
  );
}
