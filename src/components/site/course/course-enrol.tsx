import Link from "next/link";
import { ArrowRight, BadgeCheck, FileCheck, MapPin } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import type { FeeDisplay } from "@/lib/course-pricing";

export interface EnrolCentre {
  id: string;
  name: string;
  code: string;
  href: string;
  location: string;
  isVerified: boolean;
}

export interface EnrolDocument {
  key: string;
  name: string;
  description: string | null;
  isRequired: boolean;
}

/**
 * Enrol Now — the closing section.
 *
 * The CTA is `applyHref`, the same `applyHref()` every other page uses: a signed-in student goes
 * straight to `/student/apply?courseId=…`, a visitor registers first and lands on the same
 * application with this course preselected. There is no second enrolment path.
 *
 * The price line prints `FeeDisplay.text` — the whole label ("FREE", "₹999 One Time",
 * "₹499 / Month", "₹1,999 → ₹999 One Time") from the one formatter, so this section cannot drift
 * from the fee card above it.
 */
export function CourseEnrol({
  fee,
  applyHref,
  centersHref,
  centres,
  documents,
  courseName,
}: {
  fee: FeeDisplay;
  applyHref: string;
  centersHref: string;
  centres: EnrolCentre[];
  documents: EnrolDocument[];
  courseName: string;
}) {
  return (
    <div className="space-y-8 lg:space-y-10">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="card flex flex-col justify-between gap-6 card-p sm:p-8 lg:col-span-7">
          <div>
            <p className="text-overline text-muted">{fee.isFree ? "Cost to you" : fee.label}</p>
            <p className="mt-1 text-h2 text-navy">{fee.text}</p>
            <p className="mt-3 text-body text-muted">
              Apply online in a few minutes. Our admissions team reviews your application, confirms your seat at the centre you choose and tells you exactly what to pay and when.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={applyHref} size="lg" fullWidth rightIcon={<ArrowRight className="h-4 w-4" />}>
              Enrol Now
            </ButtonLink>
            <ButtonLink href="/contact?type=ADMISSION" size="lg" variant="outline" fullWidth>
              Ask a Question
            </ButtonLink>
          </div>
        </div>

        <div className="card card-p lg:col-span-5">
          <h3 className="flex items-center gap-2 text-h4 text-navy">
            <FileCheck className="h-5 w-5 shrink-0 text-orange" aria-hidden /> What you need to apply
          </h3>
          {documents.length > 0 ? (
            <ul className="mt-3 space-y-2 text-body">
              {documents.map((d) => (
                <li key={d.key} className="flex items-start gap-2">
                  <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${d.isRequired ? "bg-orange" : "bg-muted"}`} />
                  <span className="min-w-0">
                    <span className="font-medium text-ink">{d.name}</span>
                    {d.description && <span className="block text-body-sm text-muted">{d.description}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-body-sm text-muted">Nothing to prepare in advance — anything we need is requested during your application review.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-h3 text-navy">
          <MapPin className="h-6 w-6 shrink-0 text-orange" aria-hidden /> Where you can join
        </h3>
        {centres.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-7 w-7" />}
            title="No center lists this course yet"
            description={`You can still apply for ${courseName} — our team will place you at the nearest centre that runs it.`}
            action={
              <ButtonLink href={centersHref} variant="outline">
                Browse all centers
              </ButtonLink>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {centres.map((c) => (
              <li key={c.id}>
                <Link href={c.href} className="card card-hover flex h-full flex-col card-p">
                  <span className="flex items-start gap-2">
                    <span className="text-h4 text-navy">{c.name}</span>
                    {c.isVerified && <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Verified" />}
                  </span>
                  <span className="mt-1 font-mono text-caption text-muted">{c.code}</span>
                  <span className="mt-2 text-body-sm text-muted">{c.location}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
