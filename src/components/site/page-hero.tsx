import { Highlight } from "@/components/ui/highlight";
import { Breadcrumbs } from "@/components/ui/misc";
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
    <section className={cn("relative overflow-hidden bg-linear-to-br from-navy to-navy-dark text-white", className)}>
      <HeroPattern />
      <div className={cn("container-x relative", compact ? "py-12 sm:py-16" : "py-16 sm:py-20 lg:py-24", align === "center" && "text-center")}>
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

/** Subtle dot-grid + glow decoration for navy sections. */
export function HeroPattern({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
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
