import type { Metadata } from "next";
import { QrCode, ScanSearch, ShieldCheck } from "lucide-react";
import { absoluteUrl } from "@/lib/utils";
import { PageHero } from "@/components/site/page-hero";
import { VerifyCertificateForm } from "@/components/site/verify-form";

export const metadata: Metadata = {
  title: "Verify a Certificate",
  description: "Verify the authenticity of an EduSkill India Foundation certificate using its unique certificate number.",
  alternates: { canonical: absoluteUrl("/verify-certificate") },
  openGraph: { title: "Verify a Certificate", description: "Check whether an EduSkill certificate is genuine.", url: absoluteUrl("/verify-certificate"), type: "website" },
};

export default function VerifyCertificatePage() {
  return (
    <>
      <PageHero compact align="center" eyebrow="Certificate verification" title="Verify an EduSkill [[Certificate]]" description="Every certificate we issue carries a unique number. Enter it below to confirm it is genuine and view the training details." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Verify Certificate" }]} />
      <section className="container-x py-14 sm:py-20">
        <div className="mx-auto max-w-lg">
          <VerifyCertificateForm />
          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: ScanSearch, title: "Find the number", text: "It is printed on the certificate, usually under the title or beside the QR code." },
              { icon: QrCode, title: "Or scan the QR", text: "Scanning the QR code on a certificate opens this verification page automatically." },
              { icon: ShieldCheck, title: "Instant result", text: "You will see the student name, course, center and status – valid or revoked." },
            ].map((s) => (
              <li key={s.title} className="text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-lavender text-navy">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-3 text-sm font-bold text-navy">{s.title}</h2>
                <p className="mt-1 text-xs text-muted">{s.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
