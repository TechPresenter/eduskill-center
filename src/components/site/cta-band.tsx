import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Highlight } from "@/components/ui/highlight";

/**
 * The closing call-to-action band — one component, so every page ends the same way.
 *
 * Depth comes from `surface-tint-dark` (the one allowed decorative wash: two radial tints, no extra
 * element, no bytes) plus a CSS dot grid. No blurred glow elements: a `blur-3xl` layer costs a
 * full-screen GPU pass on the cheap Android phones most of our students use, and it bought nothing
 * the tint does not.
 */
export function CtaBand({
  title,
  description,
  primary,
  secondary,
}: {
  title: string;
  description?: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  const hasActions = Boolean(primary?.label || secondary?.label);
  return (
    <section className="relative isolate overflow-x-clip bg-navy surface-tint-dark text-white">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1.5px, transparent 0)", backgroundSize: "28px 28px" }}
      />
      <div className="container-x relative flex flex-col items-start gap-8 section-y lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div className="max-w-2xl">
          <h2 className="text-h1 text-white">
            <Highlight text={title} />
          </h2>
          {description && <p className="mt-4 text-body-lg text-white/80">{description}</p>}
        </div>
        {hasActions && (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:shrink-0">
            {primary?.label && (
              <ButtonLink href={primary.href} size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                {primary.label}
              </ButtonLink>
            )}
            {secondary?.label && (
              <ButtonLink href={secondary.href} size="lg" variant="white">
                {secondary.label}
              </ButtonLink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
