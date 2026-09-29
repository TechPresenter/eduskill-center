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
      {/*
        `light` means "this heading is sitting on a navy band", so both accents have to switch with
        it. eyebrow-on-navy INSTEAD of eyebrow (never both — tailwind-merge does not know either
        name, so stacking them would leave the winner to stylesheet order), and the [[…]] highlight
        moves off text-orange, which measures 2.28:1 on the logo blue, onto the 4.56:1 on-navy
        orange. Same size, weight and tracking either way; only the hue moves.
      */}
      {label && (
        <p className={cn(light ? "eyebrow-on-navy" : "eyebrow", "mb-2 flex items-center gap-1.5 lg:mb-3", align === "center" && "justify-center")}>
          {emoji && (
            <span aria-hidden="true" className="text-base leading-none">
              {emoji}
            </span>
          )}
          {label}
        </p>
      )}
      <Tag id={id} className={cn("section-title", light && "text-white")}>
        <Highlight text={title} highlightClassName={light ? "text-orange-on-navy" : "text-orange"} />
      </Tag>
      {/* Body step on phones (the h2 above is already the phone's biggest type), body-lg from lg. */}
      {description && <p className={cn("mt-2 text-body lg:mt-4 lg:text-body-lg", light ? "text-white/80" : "text-muted")}>{description}</p>}
    </div>
  );
}
