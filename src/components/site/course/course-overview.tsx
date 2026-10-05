import type { LucideIcon } from "lucide-react";
import { Users } from "lucide-react";
import { Markdown } from "@/components/site/markdown";
import { CourseGallery, type CourseGalleryImage } from "@/components/site/course/course-gallery";
import { cn } from "@/lib/utils";

export interface CourseFact {
  icon: LucideIcon;
  label: string;
  value: string;
}

/**
 * Course Overview — the description the Foundation wrote, the facts stored on the course record and
 * the gallery. Every fact is a real column: nothing is inferred, nothing is filled with a dash.
 *
 * With no description the facts spread across the full row instead of leaving a blank column, so an
 * under-filled course still looks finished rather than broken.
 */
export function CourseOverview({
  description,
  summary,
  facts,
  eligibility,
  ageText,
  gallery,
  seed,
}: {
  description: string | null;
  summary: string | null;
  facts: CourseFact[];
  eligibility: string | null;
  ageText: string | null;
  gallery: CourseGalleryImage[];
  seed: string;
}) {
  const hasProse = Boolean(description || summary);
  return (
    <div className="space-y-8 lg:space-y-10">
      <div className={cn(hasProse && "grid gap-8 lg:grid-cols-12 lg:gap-12")}>
        {hasProse && (
          <div className="min-w-0 lg:col-span-7">
            {description ? <Markdown source={description} /> : <p className="text-body-lg text-ink">{summary}</p>}
          </div>
        )}
        {facts.length > 0 && (
          <dl className={cn("grid gap-3 sm:grid-cols-2", hasProse ? "lg:col-span-5 lg:grid-cols-1" : "lg:grid-cols-4")}>
            {facts.map((f) => (
              <div key={f.label} className="card flex items-start gap-3 p-4">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-orange-light text-orange">
                  <f.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <dt className="text-overline text-muted">{f.label}</dt>
                  <dd className="mt-0.5 text-body font-semibold break-words text-ink">{f.value}</dd>
                </span>
              </div>
            ))}
          </dl>
        )}
      </div>

      {(eligibility || ageText) && (
        <div className="rounded-card bg-lavender p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-h4 text-navy">
            <Users className="h-5 w-5 shrink-0 text-orange" aria-hidden /> Who can join
          </h3>
          {eligibility && <p className="mt-2 text-body text-ink">{eligibility}</p>}
          {ageText && <p className="mt-2 text-body-sm text-muted">{ageText}</p>}
        </div>
      )}

      <CourseGallery images={gallery} seed={seed} label="Course gallery" />
    </div>
  );
}
