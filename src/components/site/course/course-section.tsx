import { SectionHeading } from "@/components/site/section-heading";
import { cn } from "@/lib/utils";

/**
 * One band of the public course page, so all nine sections share a rhythm: eyebrow, heading,
 * optional description, content. Alternating `tone` gives the page its white / lavender banding
 * without each section re-deciding its own background.
 *
 * Every section is labelled by its own heading (`aria-labelledby`) and carries a `scroll-mt` so the
 * in-page jump links land below the sticky header.
 */
export function CourseSection({
  id,
  label,
  title,
  description,
  tone = "white",
  aside,
  children,
  className,
}: {
  id: string;
  label?: string;
  title: string;
  description?: string;
  tone?: "white" | "lavender" | "surface";
  /** Right-hand content beside the heading on wide screens (a count, a CTA). */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "scroll-mt-24 section-y",
        tone === "lavender" && "bg-lavender",
        tone === "surface" && "bg-surface",
        tone === "white" && "bg-white",
        className
      )}
    >
      <div className="container-x">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <SectionHeading id={`${id}-title`} label={label} title={title} description={description} />
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        <div className="mt-6 lg:mt-10">{children}</div>
      </div>
    </section>
  );
}
