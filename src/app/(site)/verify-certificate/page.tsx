import type { Metadata } from "next";
import { QrCode, ScanSearch, ShieldCheck } from "lucide-react";
import { absoluteUrl } from "@/lib/utils";
import { PageHero } from "@/components/site/page-hero";
import { VerifyCertificateForm } from "@/components/site/verify-form";
import { SectionBg, IconTile } from "@/components/site/decor";

export const metadata: Metadata = {
  title: "Verify a Certificate",
  description: "Verify the authenticity of an EduSkill India Foundation certificate using its unique certificate number.",
  alternates: { canonical: absoluteUrl("/verify-certificate") },
  openGraph: { title: "Verify a Certificate", description: "Check whether an EduSkill certificate is genuine.", url: absoluteUrl("/verify-certificate"), type: "website" },
};

const STEPS = [
  { icon: ScanSearch, title: "Find the number", text: "It is printed on the certificate, usually under the title or beside the QR code." },
  { icon: QrCode, title: "Or scan the QR", text: "Scanning the QR code on a certificate opens this verification page automatically." },
  { icon: ShieldCheck, title: "Get an instant result", text: "You will see the student name, course, centre and status – valid or revoked." },
];

export default function VerifyCertificatePage() {
  return (
    <>
      <PageHero
        compact
        align="center"
        eyebrow="Certificate verification"
        title="Verify an EduSkill [[Certificate]]"
        description="Every certificate we issue carries a unique number. Enter it below to confirm it is genuine and view the training details."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Verify Certificate" }]}
      />

      <section className="relative overflow-x-clip bg-surface section-y">
        <SectionBg variant="rings" />
        <div className="container-x relative z-10">
          <div className="mx-auto max-w-lg">
            <VerifyCertificateForm />
          </div>

          <ol className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card flex h-full flex-col items-center card-p text-center">
                <IconTile icon={s.icon} tone="lavender" size="lg" />
                <p className="mt-4 text-overline text-orange">Step {i + 1}</p>
                <h2 className="mt-1 text-h4 text-navy">{s.title}</h2>
                <p className="mt-2 text-body-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
