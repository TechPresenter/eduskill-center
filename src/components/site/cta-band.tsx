import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Highlight } from "@/components/ui/highlight";
import { HeroPattern } from "@/components/site/page-hero";

/** Navy closing call-to-action band. */
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
  return (
    <section className="relative overflow-hidden bg-linear-to-br from-navy to-navy-dark text-white">
      <HeroPattern />
      <div className="container-x relative flex flex-col items-start gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            <Highlight text={title} />
          </h2>
          {description && <p className="mt-4 text-base text-white/80 sm:text-lg">{description}</p>}
        </div>
        {(primary || secondary) && (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {primary && primary.label && (
              <ButtonLink href={primary.href} size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                {primary.label}
              </ButtonLink>
            )}
            {secondary && secondary.label && (
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
