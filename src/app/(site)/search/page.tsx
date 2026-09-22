import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, Search, SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";
import { absoluteUrl } from "@/lib/utils";
import { PageHero } from "@/components/site/page-hero";
import { GROUP_LABELS, QUICK_LINKS, ResultRow } from "@/components/site/search/result-row";
import { normalizeSearchQuery, SEARCH_MAX_LENGTH, SEARCH_MAX_LIMIT, SEARCH_MIN_LENGTH, searchSite, type SearchGroups, type SearchResultType } from "@/server/search";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function readQuery(value: string | string[] | undefined) {
  return normalizeSearchQuery(Array.isArray(value) ? value[0] : value);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = readQuery((await searchParams).q);
  const title = q ? `Search: ${q}` : "Search";
  return {
    title,
    description: "Search courses, training centres (by name, centre code or PIN code), programs and help articles.",
    alternates: { canonical: absoluteUrl("/search") },
    // Result pages are thin, query-shaped duplicates of real pages: keep them out of the index.
    robots: { index: false, follow: true },
  };
}

const GROUPS: { type: SearchResultType; field: keyof Pick<SearchGroups, "courses" | "centres" | "programs" | "faqs"> }[] = [
  { type: "centre", field: "centres" },
  { type: "course", field: "courses" },
  { type: "program", field: "programs" },
  { type: "faq", field: "faqs" },
];

const inlineLink = "font-semibold text-orange underline-offset-4 hover:underline ring-focus";

/**
 * Shareable, no-JavaScript search results: the header palette's "See all results" and Enter both
 * land here. A plain GET form, so it works on any phone browser even before the app hydrates.
 */
export default async function SearchPage({ searchParams }: Props) {
  const q = readQuery((await searchParams).q);
  const results = q.length >= SEARCH_MIN_LENGTH ? await searchSite(q, { limit: SEARCH_MAX_LIMIT }) : null;
  const groups = results ? GROUPS.filter((g) => results[g.field].length > 0) : [];
  const pinQuery = /^\d{6}$/.test(q.replace(/\s+/g, ""));

  return (
    <>
      <PageHero compact eyebrow="Search" title="Find a [[course]] or centre" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Search" }]}>
        {/* Raw action string: a plain <form> does not get the deployment sub-path the way <Link> does. */}
        <form role="search" action={withBasePath("/search")} method="get" className="flex w-full max-w-2xl items-center gap-2 rounded-xl bg-white p-1.5 shadow-e2">
          <label htmlFor="site-search-q" className="sr-only">
            Search courses, training centres, programs and FAQs
          </label>
          <Search className="ml-2.5 h-5 w-5 shrink-0 text-navy" aria-hidden />
          <input
            id="site-search-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={SEARCH_MAX_LENGTH}
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Course, centre code, district or PIN"
            className="h-11 min-w-0 flex-1 bg-transparent px-1 text-input text-ink outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-orange px-4 text-body-sm font-semibold text-white transition duration-micro hover:bg-orange-hover active:scale-[0.98] ring-focus motion-reduce:transition-none sm:px-5"
          >
            Search
          </button>
        </form>
      </PageHero>

      <section className="bg-surface section-y" aria-labelledby="search-results-title">
        <div className="container-x">
          <div className="mx-auto max-w-3xl">
            {!results ? (
              <>
                <h2 id="search-results-title" className="text-h3 text-navy">
                  {q ? "Type at least two letters" : "Popular destinations"}
                </h2>
                <p className="mt-1 text-body text-muted">Search by course name, training centre name, centre code, district or 6-digit PIN code.</p>
                <ul className="card mt-5 space-y-0.5 p-2">
                  {QUICK_LINKS.map((l) => (
                    <li key={l.href}>
                      <ResultRow href={l.href} kind="quick" icon={l.icon} title={l.label} subtitle={l.subtitle} />
                    </li>
                  ))}
                </ul>
              </>
            ) : results.total === 0 ? (
              <div className="card flex flex-col items-center px-6 py-12 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-lavender text-navy">
                  <SearchX className="h-7 w-7" aria-hidden />
                </span>
                <h2 id="search-results-title" className="text-h3 text-navy">
                  No matches for “{results.query}”
                </h2>
                <p className="mt-1.5 max-w-md text-body text-muted">
                  {pinQuery
                    ? "We don't have a centre listed at this PIN code yet. The centre finder can show the nearest ones in your district."
                    : "Check the spelling, or try a course name, a district, a centre code or a 6-digit PIN code."}
                </p>
                <div className="mt-6 grid w-full max-w-sm grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                  <ButtonLink href={pinQuery ? `/training-centers?q=${encodeURIComponent(results.query)}` : "/training-centers"} variant="navy" leftIcon={<MapPin className="h-4 w-4" />}>
                    Centre finder
                  </ButtonLink>
                  <ButtonLink href="/contact" variant="outline" leftIcon={<Mail className="h-4 w-4" />}>
                    Contact us
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <>
                <h2 id="search-results-title" className="text-h3 text-navy">
                  <span className="tabular-nums">{results.total}</span> result{results.total === 1 ? "" : "s"} for “{results.query}”
                </h2>
                <div className="mt-5 space-y-5">
                  {groups.map((g) => {
                    const items = results[g.field];
                    return (
                      <section key={g.type} aria-labelledby={`search-group-${g.type}`} className="card p-2">
                        <div className="flex items-center justify-between px-3 pt-2 pb-1">
                          <h3 id={`search-group-${g.type}`} className="text-overline text-muted">
                            {GROUP_LABELS[g.type]}
                          </h3>
                          <span className="text-caption font-semibold text-muted tabular-nums">{items.length}</span>
                        </div>
                        <ul className="space-y-0.5">
                          {items.map((r) => (
                            <li key={r.id}>
                              <ResultRow href={r.href} kind={r.type} title={r.title} subtitle={r.subtitle} meta={r.meta} query={results.query} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>
                <p className="mt-6 text-center text-body-sm text-muted">
                  Can&apos;t find your centre? Use the{" "}
                  <Link href="/training-centers" className={inlineLink}>
                    training centre finder
                  </Link>{" "}
                  or{" "}
                  <Link href="/contact" className={inlineLink}>
                    contact us
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
