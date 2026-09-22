import { ArrowRight, GraduationCap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import type { MegaMenuFeature } from "./types";

/**
 * Left region of the Courses panel: peach card, orange cap, navy heading, two muted lines and the
 * solid orange "View All Courses" action. The soft circles in the corner are background gradients,
 * so nothing decorative can overflow the card.
 */
export function MegaMenuFeatureCard({ feature, onNavigate }: { feature: MegaMenuFeature; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col rounded-md bg-orange-light bg-[radial-gradient(circle_at_12%_100%,rgba(232,82,10,0.10)_0,rgba(232,82,10,0.10)_22%,transparent_22.5%),radial-gradient(circle_at_40%_112%,rgba(232,82,10,0.07)_0,rgba(232,82,10,0.07)_20%,transparent_20.5%)] p-5">
      <GraduationCap aria-hidden className="h-8 w-8 text-orange" strokeWidth={2} />
      <p className="mt-4 font-heading text-[22px] leading-7 font-extrabold tracking-[-0.01em] text-navy">{feature.title}</p>
      {feature.description && <p className="mt-2 text-body-sm text-muted">{feature.description}</p>}
      {feature.ctaLabel && (
        <div className="mt-5">
          <ButtonLink href={feature.ctaHref} size="sm" onClick={onNavigate} data-mega-item="" rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}>
            {feature.ctaLabel}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
