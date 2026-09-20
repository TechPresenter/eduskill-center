import { Highlight } from "@/components/ui/highlight";
import { cn } from "@/lib/utils";

/** Eyebrow + big heading (with [[orange]] highlights) + optional description. */
export function SectionHeading({
  label,
  title,
  description,
  align = "left",
  light,
  className,
  as: Tag = "h2",
  id,
  emoji,
}: {
  label?: string;
  title: string;
  description?: string;
  /**
   * Decorative emoji shown before the eyebrow label. Purely visual: it is aria-hidden, because the
   * label text already carries the meaning and screen readers would otherwise announce it.
   */
  emoji?: string;
  align?: "left" | "center";
  light?: boolean;
  className?: string;
  as?: "h1" | "h2" | "h3";
  id?: string;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {label && (
        <p className={cn("eyebrow mb-3 flex items-center gap-1.5", align === "center" && "justify-center")}>
          {emoji && (
            <span aria-hidden="true" className="text-base leading-none">
              {emoji}
            </span>
          )}
          {label}
        </p>
      )}
      <Tag id={id} className={cn("section-title", light && "text-white")}>
        <Highlight text={title} />
      </Tag>
      {description && <p className={cn("mt-4 text-base leading-relaxed sm:text-lg", light ? "text-white/80" : "text-muted")}>{description}</p>}
    </div>
  );
}
