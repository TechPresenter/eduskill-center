import Link from "next/link";
import { ArrowRight, Clock, Layers, MonitorSmartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/icon";
import { Media } from "@/components/site/safe-image";
import type { PublicCourseCard } from "@/server/public";
import { formatINR, titleCase } from "@/lib/utils";

/** One fact from the course record: an icon, an invisible label and the value. */
function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-4 w-4 shrink-0 text-orange" aria-hidden />
      <dt className="sr-only">{label}</dt>
      <dd className="truncate text-body-sm text-muted">{value}</dd>
    </div>
  );
}

/**
 * A course in the public catalogue.
 *
 * The cover is a `media media-16x9` frame, the same ratio the detail page uses, so a course
 * photograph is never cropped two different ways — and when there is none (the common case) the
 * branded placeholder fills the identical box, with the course icon laid over it.
 */
export function CourseCard({ course, applyHref }: { course: PublicCourseCard; applyHref: string }) {
  const href = `/courses/${course.slug}`;

  return (
    <article className="group card card-hover relative flex h-full flex-col overflow-hidden">
      {/* Zero-radius wrapper: `media` inherits its radius, so this is what rounds the top corners
          and leaves the bottom edge square against the body. */}
      <div className="rounded-t-card">
        <Media src={course.image} alt={course.image ? course.name : ""} seed={course.slug} ratio="16x9" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw">
          {!course.image && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-card bg-white/90 text-orange shadow-e1">
                <DynamicIcon name={course.icon ?? course.category?.icon ?? undefined} className="h-8 w-8" aria-hidden />
              </span>
            </span>
          )}
          {(course.category || course.scholarshipAvailable) && (
            <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {course.category && <Badge tone="navy">{course.category.name}</Badge>}
              {course.scholarshipAvailable && <Badge tone="orange">Scholarship</Badge>}
            </span>
          )}
        </Media>
      </div>

      <div className="flex flex-1 flex-col card-p">
        <h3 className="text-h3 text-navy">
          {/* Stretched link: the whole card is the tap target, the buttons below are raised over it. */}
          <Link href={href} className="transition-colors duration-micro after:absolute after:inset-0 hover:text-orange focus-visible:text-orange motion-reduce:transition-none">
            {course.name}
          </Link>
        </h3>
        {course.shortDescription && <p className="mt-2 line-clamp-2 text-body text-muted">{course.shortDescription}</p>}

        <dl className="mt-4 grid grid-cols-3 gap-x-2 gap-y-1">
          <Fact icon={Clock} label="Duration" value={course.durationText} />
          <Fact icon={Layers} label="Level" value={titleCase(course.level)} />
          <Fact icon={MonitorSmartphone} label="Mode" value={titleCase(course.mode)} />
        </dl>

        <div className="mt-auto pt-4">
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-4">
            <span className="text-overline text-muted">Course fee</span>
            <span className="text-h3 text-navy tabular-nums">{course.courseFee > 0 ? formatINR(course.courseFee) : "Free"}</span>
          </div>
          <div className="relative z-raised mt-4 grid grid-cols-2 gap-2">
            <ButtonLink href={href} variant="outline" size="sm">
              Details
            </ButtonLink>
            <ButtonLink href={applyHref} size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Apply
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Thumb-sized course card for the phone home screen's swipe rail: cover, category, name and the two
 * facts people decide on (duration, fee). The whole card is one link; details and Apply live on the
 * course page, one tap away.
 */
export function CourseCardCompact({ course }: { course: PublicCourseCard }) {
  const href = `/courses/${course.slug}`;
  return (
    <article className="card relative flex h-full flex-col overflow-hidden">
      <div className="rounded-t-card">
        <Media src={course.image} alt="" seed={course.slug} ratio="16x9" sizes="(max-width: 640px) 75vw, 40vw">
          {!course.image && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-12 items-center justify-center rounded-lg bg-white/90 text-orange shadow-e1">
                <DynamicIcon name={course.icon ?? course.category?.icon ?? undefined} className="size-6" aria-hidden />
              </span>
            </span>
          )}
          {course.scholarshipAvailable && (
            <span className="absolute top-2.5 left-2.5">
              <Badge tone="orange">Scholarship</Badge>
            </span>
          )}
        </Media>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        {course.category && <p className="truncate text-caption font-semibold text-orange">{course.category.name}</p>}
        <h3 className="mt-0.5 line-clamp-2 text-h4 text-navy">
          <Link href={href} className="ring-focus after:absolute after:inset-0 after:rounded-card">
            {course.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-body-sm text-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <Clock className="size-4 shrink-0 text-orange" aria-hidden />
            <span className="truncate">{course.durationText}</span>
          </span>
          <span className="shrink-0 font-heading font-bold text-navy tabular-nums">{course.courseFee > 0 ? formatINR(course.courseFee) : "Free"}</span>
        </div>
      </div>
    </article>
  );
}
