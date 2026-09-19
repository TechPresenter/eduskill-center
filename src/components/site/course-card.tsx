import Link from "next/link";
import { Clock, Layers, MonitorSmartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/icon";
import { SafeImage } from "@/components/site/safe-image";
import type { PublicCourseCard } from "@/server/public";
import { formatINR, titleCase } from "@/lib/utils";

export function CourseCard({ course, applyHref }: { course: PublicCourseCard; applyHref: string }) {
  return (
    <article className="card card-hover flex h-full flex-col overflow-hidden">
      <div className="relative h-40 bg-lavender">
        {course.image ? (
          <SafeImage src={course.image} alt={course.name} sizes="(max-width: 640px) 100vw, 33vw" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-orange shadow-card">
              <DynamicIcon name={course.icon ?? course.category?.icon ?? undefined} className="h-8 w-8" aria-hidden />
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {course.category && <Badge tone="navy">{course.category.name}</Badge>}
          {course.scholarshipAvailable && <Badge tone="orange">Scholarship</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-navy">
          <Link href={`/courses/${course.slug}`} className="hover:text-orange">
            {course.name}
          </Link>
        </h3>
        {course.shortDescription && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{course.shortDescription}</p>}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-orange" aria-hidden />
            <dt className="sr-only">Duration</dt>
            <dd className="truncate">{course.durationText}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-orange" aria-hidden />
            <dt className="sr-only">Level</dt>
            <dd>{titleCase(course.level)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <MonitorSmartphone className="h-3.5 w-3.5 text-orange" aria-hidden />
            <dt className="sr-only">Mode</dt>
            <dd>{titleCase(course.mode)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">Course fee</span>
          <span className="font-heading text-xl font-extrabold text-navy">{course.courseFee > 0 ? formatINR(course.courseFee) : "Free"}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ButtonLink href={`/courses/${course.slug}`} variant="outline" size="sm">
            View Course
          </ButtonLink>
          <ButtonLink href={applyHref} size="sm">
            Apply Now
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
