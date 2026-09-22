import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, BadgeCheck, SearchX, ShieldX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { absoluteUrl, cn, formatDate } from "@/lib/utils";
import { verifyCertificate } from "@/server/certificates";
import { hashIp } from "@/server/analytics";
import { PageHero } from "@/components/site/page-hero";
import { VerifyCertificateForm } from "@/components/site/verify-form";
import { SectionBg } from "@/components/site/decor";

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

  const rows: { label: string; value: React.ReactNode }[] = cert
    ? [
        { label: "Certificate number", value: <span className="tabular-nums">{cert.certificateNo}</span> },
        { label: "Student name", value: cert.studentName },
        { label: "Course", value: <Link href={`/courses/${cert.courseSlug}`} className="ring-focus rounded-xs text-navy underline-offset-2 hover:underline">{cert.courseName}</Link> },
        { label: "Training center", value: <Link href={cert.centerUrl} className="ring-focus rounded-xs text-navy underline-offset-2 hover:underline">{cert.centerName} ({cert.centerCode})</Link> },
        { label: "Location", value: cert.location },
        { label: "Duration", value: cert.durationText },
        { label: "Completion date", value: formatDate(cert.completionDate) },
        { label: "Issued on", value: formatDate(cert.issuedAt) },
        ...(cert.grade ? [{ label: "Grade", value: cert.grade }] : []),
        ...(revoked ? [{ label: "Revoked on", value: formatDate(cert.revokedAt) }, { label: "Reason", value: cert.revokedReason ?? "Not specified" }] : []),
      ]
    : [];

  return (
    <>
      <PageHero
        compact
        align="center"
        eyebrow="Certificate verification"
        title={valid ? "Certificate is [[Valid]]" : revoked ? "Certificate [[Revoked]]" : "Certificate [[Not Found]]"}
        description={`Result for certificate number ${no}`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Verify Certificate", href: "/verify-certificate" }, { label: no }]}
      />

      <section className="relative overflow-x-clip bg-surface section-y">
        <SectionBg variant="rings" />
        <div className="container-x relative z-10">
          <div className="mx-auto max-w-2xl">
            <div className={cn("card overflow-hidden rounded-card-lg", valid ? "border-success/40" : revoked ? "border-danger/40" : "border-line")}>
              {/*
               * The verdict band carries the answer in one word, at heading size, on a colour the
               * reader recognises before reading. `role="status"` so it is announced on arrival.
               */}
              <div className={cn("flex items-center gap-4 px-6 py-6 text-white", valid ? "bg-success-dark" : revoked ? "bg-danger" : "bg-navy")} role="status">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
                  {valid ? <BadgeCheck className="h-7 w-7" aria-hidden /> : revoked ? <ShieldX className="h-7 w-7" aria-hidden /> : <SearchX className="h-7 w-7" aria-hidden />}
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-h2 text-white">{valid ? "Valid" : revoked ? "Revoked" : "Not found"}</p>
                  <p className="mt-1 text-body text-white/85">
                    {valid
                      ? "This certificate was issued by EduSkill India Foundation and is genuine."
                      : revoked
                        ? "This certificate has been withdrawn and is no longer valid."
                        : "No certificate matches this number. Check for typing mistakes and try again."}
                  </p>
                </div>
              </div>

              {rows.length > 0 && (
                <dl className="grid gap-x-8 gap-y-5 p-6 sm:grid-cols-2 sm:p-8">
                  {rows.map((row) => (
                    <div key={row.label} className="flex flex-col gap-1">
                      <dt className="text-overline text-muted">{row.label}</dt>
                      <dd className="text-body font-medium text-ink">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="flex flex-col gap-4 border-t border-line bg-surface px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-caption text-muted">Verified on {formatDate(new Date(), "dd MMM yyyy, hh:mm a")}. Share this page link as proof of verification.</p>
                <ButtonLink href="/verify-certificate" variant="outline" className="shrink-0" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                  Verify another
                </ButtonLink>
              </div>
            </div>

            {!cert && (
              <div className="mt-8">
                <p className="mb-4 text-center text-body text-muted">Check the number and try again — letters and digits only, exactly as printed.</p>
                <VerifyCertificateForm initial={no} />
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
