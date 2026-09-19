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
}: {
  label?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  light?: boolean;
  className?: string;
  as?: "h1" | "h2" | "h3";
  id?: string;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {label && <p className={cn("eyebrow mb-3", align === "center" && "justify-center")}>{label}</p>}
      <Tag id={id} className={cn("section-title", light && "text-white")}>
        <Highlight text={title} />
      </Tag>
      {description && <p className={cn("mt-4 text-base leading-relaxed sm:text-lg", light ? "text-white/80" : "text-muted")}>{description}</p>}
    </div>
  );
}
