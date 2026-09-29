import { SectionBg } from "@/components/site/decor";
import { SafeImage } from "@/components/site/safe-image";

/**
 * Lavender band under the hero: one line of reassurance plus the partner logos we actually have.
 * Never invents a logo wall — with no partners the band is heading-only, and callers can switch it
 * off entirely with `showWhenEmpty: false`.
 */
export function TrustStrip({ section, partners }: { section: { heading?: string; subheading?: string; showWhenEmpty?: boolean }; partners: { id: string; name: string; logoUrl: string; website: string | null }[] }) {
  if (partners.length === 0 && section.showWhenEmpty === false) return null;
  if (!section.heading && !section.subheading && partners.length === 0) return null;

  return (
    <section className="relative overflow-x-clip bg-lavender section-y" aria-label="Partners and supporters">
      {/* A hairline of the logo's blue→green sweep, closing the seam with the navy hero above: the
          hero's swoosh runs off its bottom edge and this picks the same two hues back up. A 4px
          decorative fill, so no contrast floor applies to it — and no layout, so the band is
          unchanged for anything that cannot paint it. */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-navy via-navy-light to-green" />
      <SectionBg variant="dots" className="opacity-60" />
      <div className="container-x relative z-10 flex flex-col items-center gap-10 lg:flex-row lg:justify-between lg:gap-12">
        <div className="max-w-xl text-center lg:text-left">
          {section.heading && <p className="text-h2 text-navy">{section.heading}</p>}
          {/* Not `text-muted`: #667085 on lavender is 4.15:1, and text-body-lg is 17px regular, which
              is not "large text" — it needs the full 4.5. `text-ink/65` composites to #606777 for
              4.73:1 and still reads as the quieter line beside the navy heading. */}
          {section.subheading && <p className="mt-3 text-body-lg text-ink/65">{section.subheading}</p>}
        </div>
        {partners.length > 0 && (
          <ul className="flex flex-wrap items-center justify-center gap-4">
            {partners.map((p) => {
              // 1:1 is the ratio for every logo and avatar; object-contain keeps a wide wordmark from
              // being cropped inside the circle, and the padding stops it touching the edge.
              const logo = (
                <span className="relative block h-12 w-12">
                  <SafeImage src={p.logoUrl} alt={p.name} sizes="48px" className="object-contain" />
                </span>
              );
              const frame = "flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-e1";
              return (
                <li key={p.id}>
                  {p.website ? (
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${p.name} (opens in a new tab)`}
                      className={`${frame} ring-focus transition-all duration-micro ease-soft hover:-translate-y-1 hover:shadow-e2 motion-reduce:transition-none`}
                    >
                      {logo}
                    </a>
                  ) : (
                    <span className={frame} title={p.name}>
                      {logo}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
