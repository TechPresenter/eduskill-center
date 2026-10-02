import Link from "next/link";
import { ArrowRight, Clock, Layers, MonitorSmartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/icon";
import { Media } from "@/components/site/safe-image";
import type { PublicCourseCard } from "@/server/public";
import { formatINR, titleCase } from "@/lib/utils";
import { FREE_LABEL, feeHeadline } from "@/lib/course-pricing";

/**
 * Brand green as a badge, because `Badge` has no green tone yet (see program-card.tsx for the
 * family rules). The three classes are exactly what a `tone="green"` would set: bg-green-light with
 * text-green-dark measures 5.89:1, where the orange tone this replaced was 3.24:1 at 12px.
 * `cn()` inside Badge folds these over the neutral tone's bg/text/border and keeps `text-caption`,
 * because utils.ts teaches tailwind-merge the type scale.
 */
const GREEN_BADGE = "bg-green-light text-green-dark border-green/20";

/** One fact from the course record: an icon, an invisible label and the value. */
function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-4 w-4 shrink-0 text-navy-light" aria-hidden />
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
 *
 * Money carries the card's hierarchy: a course with no fee prints it in green-dark (6.61:1) and a
 * scholarship wears the green badge, so the two things that decide whether someone can afford the
 * course are the only things on the card that are not navy. The fee line comes from feeHeadline():
 * a monthly fee carries its "/ month" in muted text, and a registration-only course (Class 1–4)
 * is labelled "Registration fee", so the amount itself stays the figure the eye lands on.
 */
export function CourseCard({ course, applyHref }: { course: PublicCourseCard; applyHref: string }) {
  const href = `/courses/${course.slug}`;
  const fee = feeHeadline(course);
  const noFee = fee.kind === "none";

  return (
    <article className="group card card-hover relative flex h-full flex-col overflow-hidden">
      {/* Zero-radius wrapper: `media` inherits its radius, so this is what rounds the top corners
          and leaves the bottom edge square against the body. */}
      <div className="rounded-t-card">
        <Media src={course.image} alt={course.image ? course.name : ""} seed={course.slug} ratio="16x9" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw">
          {!course.image && (
            <span className="absolute inset-0 flex items-center justify-center">
              {/* Navy, not orange: the placeholder art already spends the one orange accent it is
                  allowed, and navy on white/90 is 8.49:1 against the pale geometry behind it. */}
              <span className="flex h-16 w-16 items-center justify-center rounded-card bg-white/90 text-navy shadow-e1">
                <DynamicIcon name={course.icon ?? course.category?.icon ?? undefined} className="h-8 w-8" aria-hidden />
              </span>
            </span>
          )}
          {(course.category || course.scholarshipAvailable) && (
            <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {course.category && <Badge tone="navy">{course.category.name}</Badge>}
              {course.scholarshipAvailable && <Badge className={GREEN_BADGE}>Scholarship</Badge>}
            </span>
          )}
        </Media>
      </div>

      <div className="flex flex-1 flex-col card-p">
        <h3 className="text-h3 text-navy">
          {/* Stretched link: the whole card is the tap target, the buttons below are raised over it.
              `ring-focus` as well as the hue shift — navy → navy-light is 1.4:1 against itself, so
              on its own it is not a focus indicator a keyboard user can find. */}
          <Link
            href={href}
            className="ring-focus transition-colors duration-micro ease-soft after:absolute after:inset-0 hover:text-navy-light focus-visible:text-navy-light motion-reduce:transition-none"
          >
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
            <span className="text-overline text-muted">{fee.label}</span>
            <span className={noFee ? "text-h3 text-green-dark tabular-nums" : "text-h3 text-navy tabular-nums"}>
              {noFee ? FREE_LABEL : formatINR(fee.amount)}
              {fee.suffix && <span className="text-body-sm font-semibold text-muted">{fee.suffix}</span>}
            </span>
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
  const fee = feeHeadline(course);
  const noFee = fee.kind === "none";
  return (
    <article className="card relative flex h-full flex-col overflow-hidden">
      <div className="rounded-t-card">
        <Media src={course.image} alt="" seed={course.slug} ratio="16x9" sizes="(max-width: 640px) 75vw, 40vw">
          {!course.image && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-12 items-center justify-center rounded-lg bg-white/90 text-navy shadow-e1">
                <DynamicIcon name={course.icon ?? course.category?.icon ?? undefined} className="size-6" aria-hidden />
              </span>
            </span>
          )}
          {course.scholarshipAvailable && (
            <span className="absolute top-2.5 left-2.5">
              <Badge className={GREEN_BADGE}>Scholarship</Badge>
            </span>
          )}
        </Media>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {/* navy-light, not orange: 12px orange is 3.72:1. navy-light is 5.82 and still tints the
            category without
            competing with the navy title directly under it. */}
        {course.category && <p className="truncate text-caption font-semibold text-navy-light">{course.category.name}</p>}
        <h3 className="mt-0.5 line-clamp-2 text-h4 text-navy">
          <Link href={href} className="ring-focus after:absolute after:inset-0 after:rounded-card">
            {course.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-body-sm text-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <Clock className="size-4 shrink-0 text-navy-light" aria-hidden />
            <span className="truncate">{course.durationText}</span>
          </span>
          <span className={noFee ? "shrink-0 font-heading font-bold text-green-dark tabular-nums" : "shrink-0 font-heading font-bold text-navy tabular-nums"}>
            {noFee ? FREE_LABEL : formatINR(fee.amount)}
            {fee.suffix && <span className="text-caption font-semibold text-muted">{fee.suffix}</span>}
            {fee.kind === "registration" && <span className="text-caption font-semibold text-muted"> registration</span>}
          </span>
        </div>
      </div>
    </article>
  );
}
