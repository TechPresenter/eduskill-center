import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, BadgeCheck, SearchX, ShieldX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { verifyCertificate } from "@/server/certificates";
import { hashIp } from "@/server/analytics";
import { PageHero } from "@/components/site/page-hero";
import { VerifyCertificateForm } from "@/components/site/verify-form";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ certificateNumber: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { certificateNumber } = await params;
  const no = decodeURIComponent(certificateNumber).toUpperCase();
  return {
    title: `Verify certificate ${no}`,
    description: "Certificate verification result.",
    robots: { index: false, follow: false },
    alternates: { canonical: absoluteUrl("/verify-certificate") },
  };
}

export default async function VerifyResultPage({ params }: Props) {
  const { certificateNumber } = await params;
  const no = decodeURIComponent(certificateNumber).trim().toUpperCase().slice(0, 60);
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const cert = no ? await verifyCertificate(no, { ip: hashIp(ip) }) : null;
  const valid = cert?.status === "ISSUED";
  const revoked = cert?.status === "REVOKED";

  return (
    <>
      <PageHero compact align="center" eyebrow="Certificate verification" title={valid ? "Certificate is [[Valid]]" : revoked ? "Certificate [[Revoked]]" : "Certificate [[Not Found]]"} description={`Result for certificate number ${no}`} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Verify Certificate", href: "/verify-certificate" }, { label: no }]} />

      <section className="container-x py-14 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <div className={cn("card overflow-hidden rounded-card-lg", valid ? "border-success/40" : revoked ? "border-danger/40" : "border-line")}>
            <div className={cn("flex items-center gap-4 px-6 py-5 text-white", valid ? "bg-success" : revoked ? "bg-danger" : "bg-navy")} role="status">
              {valid ? <BadgeCheck className="h-8 w-8 shrink-0" aria-hidden /> : revoked ? <ShieldX className="h-8 w-8 shrink-0" aria-hidden /> : <SearchX className="h-8 w-8 shrink-0" aria-hidden />}
              <div>
                <p className="font-heading text-xl font-extrabold">{valid ? "VALID" : revoked ? "REVOKED" : "NOT FOUND"}</p>
                <p className="text-sm text-white/85">{valid ? "This certificate was issued by EduSkill India Foundation and is genuine." : revoked ? "This certificate has been withdrawn and is no longer valid." : "No certificate matches this number. Check for typing mistakes and try again."}</p>
              </div>
            </div>
            {cert && (
              <dl className="grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2 sm:p-8">
                {[
                  { label: "Certificate number", value: cert.certificateNo },
                  { label: "Student name", value: cert.studentName },
                  { label: "Course", value: <Link href={`/courses/${cert.courseSlug}`} className="text-navy underline-offset-2 hover:underline">{cert.courseName}</Link> },
                  { label: "Training center", value: <Link href={cert.centerUrl} className="text-navy underline-offset-2 hover:underline">{cert.centerName} ({cert.centerCode})</Link> },
                  { label: "Location", value: cert.location },
                  { label: "Duration", value: cert.durationText },
                  { label: "Completion date", value: formatDate(cert.completionDate) },
                  { label: "Issued on", value: formatDate(cert.issuedAt) },
                  ...(cert.grade ? [{ label: "Grade", value: cert.grade }] : []),
                  ...(revoked ? [{ label: "Revoked on", value: formatDate(cert.revokedAt) }, { label: "Reason", value: cert.revokedReason ?? "Not specified" }] : []),
                ].map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5">
                    <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{row.label}</dt>
                    <dd className="text-sm font-medium text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex flex-col gap-3 border-t border-line bg-surface px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">Verified on {formatDate(new Date(), "dd MMM yyyy, hh:mm a")}. Share this page link as proof of verification.</p>
              <ButtonLink href="/verify-certificate" variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Verify another
              </ButtonLink>
            </div>
          </div>
          {!cert && (
            <div className="mt-8">
              <VerifyCertificateForm initial={no} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
