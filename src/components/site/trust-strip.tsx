/** Lavender band under the hero with a heading and circular partner logos (no fake logos when empty). */
export function TrustStrip({ section, partners }: { section: { heading?: string; subheading?: string; showWhenEmpty?: boolean }; partners: { id: string; name: string; logoUrl: string; website: string | null }[] }) {
  if (partners.length === 0 && section.showWhenEmpty === false) return null;
  return (
    <section className="bg-lavender" aria-label="Partners and supporters">
      <div className="container-x flex flex-col items-center gap-8 py-12 lg:flex-row lg:justify-between">
        <div className="max-w-xl text-center lg:text-left">
          {section.heading && <p className="font-heading text-xl font-extrabold text-navy sm:text-2xl">{section.heading}</p>}
          {section.subheading && <p className="mt-1.5 text-sm text-muted sm:text-base">{section.subheading}</p>}
        </div>
        {partners.length > 0 && (
          <ul className="flex flex-wrap items-center justify-center gap-4">
            {partners.map((p) => {
              const logo = (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.logoUrl} alt={p.name} className="h-12 w-12 object-contain" loading="lazy" />
              );
              return (
                <li key={p.id} title={p.name}>
                  {p.website ? (
                    <a href={p.website} target="_blank" rel="noopener noreferrer" aria-label={p.name} className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-card transition-transform hover:-translate-y-1">
                      {logo}
                    </a>
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-card">{logo}</span>
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
