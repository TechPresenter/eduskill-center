import { Highlight } from "@/components/ui/highlight";
import { Breadcrumbs } from "@/components/ui/misc";
import { SectionBg } from "@/components/site/decor";
import { cn } from "@/lib/utils";

/** Navy hero band used at the top of inner pages. */
export function PageHero({
  eyebrow,
  title,
  description,
  breadcrumbs,
  children,
  align = "left",
  compact,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  children?: React.ReactNode;
  align?: "left" | "center";
  compact?: boolean;
  className?: string;
}) {
  return (
    // `isolate` keeps the decorative layers in their own stacking context, and `overflow-hidden`
    // clips them — a hero decoration must never be able to widen the document.
    <section className={cn("relative isolate overflow-hidden bg-linear-to-br from-navy to-navy-dark text-white", className)}>
      <SectionBg variant="mesh" tone="navy" className="opacity-80" />
      <HeroPattern />
      <div className={cn("container-x relative z-10", compact ? "py-12 sm:py-16" : "py-16 sm:py-20 lg:py-24", align === "center" && "text-center")}>
        {breadcrumbs && (
          <Breadcrumbs
            items={breadcrumbs}
            className={cn("mb-5 text-white/60 [&_a:hover]:text-white [&_span[aria-current]]:text-white/90", align === "center" && "justify-center")}
          />
        )}
        {eyebrow && <p className={cn("eyebrow mb-3 text-orange", align === "center" && "justify-center")}>{eyebrow}</p>}
        <h1 className={cn("max-w-4xl font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl lg:leading-[1.08]", align === "center" && "mx-auto")}>
          <Highlight text={title} />
        </h1>
        {description && <p className={cn("mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg", align === "center" && "mx-auto")}>{description}</p>}
        {children && <div className={cn("mt-8", align === "center" && "flex justify-center")}>{children}</div>}
      </div>
    </section>
  );
}

/**
 * Subtle dot-grid + glow decoration for navy sections.
 *
 * The two glows are deliberately larger than their anchor corner (`-top-32 -right-24 h-96 w-96`), so
 * the layer clips ITSELF: hosts must not have to remember `overflow-hidden` to avoid a 96px-wide
 * strip of horizontal page scroll on a 360px phone.
 */
export function HeroPattern({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <svg className="absolute inset-0 h-full w-full opacity-[0.12]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="esk-dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="#ffffff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#esk-dots)" />
      </svg>
      <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-orange/20 blur-3xl" />
      <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-navy-light/40 blur-3xl" />
    </div>
  );
}
