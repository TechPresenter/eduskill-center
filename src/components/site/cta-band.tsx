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
      {/* Same rhythm as every band (section-y); the type steps down one on phones — h2 title, body
          copy — so the closing band matches the section headings above it instead of shouting. */}
      <div className="container-x relative flex flex-col items-start gap-6 section-y lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div className="max-w-2xl">
          {/* The highlighted word is the only coloured text on a navy field, so it takes the on-navy
              orange: the default text-orange is 2.28:1 here, text-orange-on-navy 4.56:1 (3.58:1 under
              the lightest corner of surface-tint-dark's white wash — still clear of the 3:1 floor this
              24/30px 700 heading answers to). The orange BUTTON below keeps plain bg-orange: its label
              sits on the orange, not on the navy. */}
          <h2 className="text-h2 text-balance text-white lg:text-h1">
            <Highlight text={title} highlightClassName="text-orange-on-navy" />
          </h2>
          {description && <p className="mt-2 text-body text-white/80 lg:mt-4 lg:text-body-lg">{description}</p>}
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
