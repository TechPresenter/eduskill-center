import { Suspense, cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Compass, List, Map as MapIcon, RotateCcw, SearchX, UserPlus } from "lucide-react";
import { getSection } from "@/lib/cms";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl, buildQuery, cn } from "@/lib/utils";
import { stripHighlight } from "@/components/ui/highlight";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { SitePagination } from "@/components/site/pagination";
import { centerSearchSchema, type CenterSearchQuery } from "@/lib/validation/centers";
import { searchCenters } from "@/server/centers";
import { listStatesWithCenters } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { SectionBg } from "@/components/site/decor";
import { Reveal } from "@/components/site/reveal";
import { CenterSearchForm } from "@/components/site/center-search-form";
import { CenterCard } from "@/components/site/center-card";
import { CenterMap } from "@/components/site/center-map";
import { CtaBand } from "@/components/site/cta-band";
import { applyHref } from "@/components/site/apply-link";

interface HeadingSection {
  label?: string;
  title: string;
  description?: string;
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

type StateWithCenters = Awaited<ReturnType<typeof listStatesWithCenters>>[number];
type Viewer = { role: string } | null;

/**
 * One search per request, shared by the count in the results header and the grid below it, so the
 * two Suspense boundaries cannot double-query (or double-log the CENTER_SEARCH analytics event).
 * `cache` keys on argument identity — `q` is parsed once per request and passed down unchanged.
 */
const getResults = cache((q: CenterSearchQuery) => searchCenters(q));

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSection<HeadingSection>("home.centerSearch");
  const title = "Training Centers";
  const description = s.description ?? stripHighlight(s.title);
  return { title, description, alternates: { canonical: absoluteUrl("/training-centers") }, openGraph: { title, description, url: absoluteUrl("/training-centers"), type: "website" } };
}

function parseSearch(sp: Record<string, string | string[] | undefined>): { q: CenterSearchQuery; view: "list" | "map" } {
  const clean: Record<string, string> = {};
  for (const key of ["stateId", "districtId", "blockId", "courseId", "q", "pincode", "page", "limit"]) {
    const v = sp[key];
    const str = Array.isArray(v) ? v[0] : v;
    if (str && str.trim()) clean[key] = str.trim();
  }
  const parsed = centerSearchSchema.safeParse(clean);
  const q: CenterSearchQuery = parsed.success ? parsed.data : centerSearchSchema.parse({ page: clean.page, q: clean.q });
  return { q, view: sp.view === "map" ? "map" : "list" };
}

/* ─────────────────────────── loading skeletons ─────────────────────────── */

/** Mirrors CenterCard: navy identity banner, title, location, course chips, three stats, actions. */
function CenterCardSkeleton() {
  return (
    <div className="card h-full overflow-hidden" aria-hidden>
      <div className="flex h-24 items-center gap-3 bg-navy/90 px-4">
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl bg-white/20" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-28 bg-white/20" />
          <Skeleton className="h-4 w-20 rounded-full bg-white/15" />
        </div>
      </div>
      <div className="flex flex-col p-4">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-3 h-3.5 w-3/4" />
        <Skeleton className="mt-2 h-3 w-1/2" />
        <div className="mt-3 flex gap-1">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1 border-t border-line pt-3 pb-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3.5 w-7" />
              <Skeleton className="h-2.5 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function CenterGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <CenterCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────── results ─────────────────────────── */

async function ResultCount({ q, hasFilter }: { q: CenterSearchQuery; hasFilter: boolean }) {
  const { meta } = await getResults(q);
  return (
    <>
      <span className="font-heading text-lg font-extrabold text-navy tabular-nums">{meta.total}</span>{" "}
      <span>
        active training center{meta.total === 1 ? "" : "s"}
        {hasFilter ? " match your search" : " across India"}
      </span>
    </>
  );
}

async function CenterResults({ q, states, user }: { q: CenterSearchQuery; states: StateWithCenters[]; user: Viewer }) {
  const result = await getResults(q);
  const hasFilter = !!(q.stateId || q.districtId || q.blockId || q.courseId || q.q);
  const baseParams = { stateId: q.stateId, districtId: q.districtId, blockId: q.blockId, courseId: q.courseId, q: q.q };
  const hrefFor = (page: number) => `/training-centers${buildQuery({ ...baseParams, page: page > 1 ? page : undefined })}`;

  if (result.items.length === 0) {
    return (
      <EmptyState
        className="border-navy/10 bg-white/70"
        icon={<SearchX className="h-7 w-7" />}
        title={hasFilter ? "No centers match those filters" : "No centers listed yet"}
        description={
          hasFilter
            ? "Try widening the search: drop the block or the course first, then the district. Every centre we verify appears here the same day."
            : "Training centers appear here as soon as our team verifies them. Register and we will tell you the moment one opens near you."
        }
        action={
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-wrap justify-center gap-3">
              {hasFilter ? (
                <>
                  <ButtonLink href="/training-centers" variant="navy" size="md" leftIcon={<RotateCcw className="h-4 w-4" />}>
                    Clear all filters
                  </ButtonLink>
                  <ButtonLink href={`/training-centers${buildQuery({ view: "map" })}`} variant="outline" size="md" leftIcon={<MapIcon className="h-4 w-4" />}>
                    Search on the map
                  </ButtonLink>
                </>
              ) : (
                <ButtonLink href="/register" size="md" leftIcon={<UserPlus className="h-4 w-4" />}>
                  Register for updates
                </ButtonLink>
              )}
            </div>
            {states.length > 0 && (
              <div>
                <p className="text-xs font-bold tracking-wider text-muted uppercase">
                  <Compass className="mr-1.5 -mt-0.5 inline h-3.5 w-3.5 text-orange" aria-hidden />
                  Centers are open in
                </p>
                <ul className="mt-3 flex max-w-xl flex-wrap justify-center gap-2">
                  {states.slice(0, 10).map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/training-centers/${s.slug}`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[13px] font-semibold text-navy transition-colors duration-200 hover:border-orange hover:text-orange motion-reduce:transition-none"
                      >
                        {s.name}
                        <span className="rounded-full bg-lavender px-1.5 text-xs text-navy tabular-nums">{s.centerCount}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        }
      />
    );
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
        {result.items.map((c, i) => (
          // Staggered along the row only (max 180 ms), so a long list never feels like a queue.
          <Reveal as="li" key={c.id} delay={(i % 4) * 60}>
            <CenterCard center={c} applyHref={applyHref(user, { centerId: c.id, courseId: q.courseId })} />
          </Reveal>
        ))}
      </ul>
      <SitePagination page={result.meta.page} totalPages={result.meta.totalPages} total={result.meta.total} limit={result.meta.limit} hrefFor={hrefFor} className="mt-10" />
    </>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

export default async function TrainingCentersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { q, view } = parseSearch(sp);
  const [section, states, user] = await Promise.all([getSection<HeadingSection>("home.centerSearch"), listStatesWithCenters(), getSessionUser().catch(() => null)]);
  const hasFilter = !!(q.stateId || q.districtId || q.blockId || q.courseId || q.q);
  const baseParams = { stateId: q.stateId, districtId: q.districtId, blockId: q.blockId, courseId: q.courseId, q: q.q };
  // Re-suspend (and show the skeleton again) whenever the search changes on a client navigation.
  const resultsKey = `${q.stateId ?? ""}|${q.districtId ?? ""}|${q.blockId ?? ""}|${q.courseId ?? ""}|${q.q ?? ""}|${q.page}`;

  const tab = (active: boolean) =>
    cn(
      "relative z-10 inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none sm:h-10",
      active ? "text-white" : "text-ink hover:text-navy"
    );

  return (
    <>
      <PageHero eyebrow={section.label} title={section.title} description={section.description} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Training Centers" }]} />

      {/* overflow-x-clip, not overflow-hidden: the decor layer must not widen the page, but the
          search card is deliberately pulled up into the hero above and overflow-hidden clipped it. */}
      <section className="relative overflow-x-clip bg-lavender pb-8 sm:pb-10">
        <SectionBg variant="dots" tone="light" className="opacity-60" />
        <div className="container-x relative z-10">
          <div className="card relative z-10 -mt-10 rounded-card-lg p-4 shadow-card-hover sm:-mt-12 sm:p-6">
            <CenterSearchForm initial={{ stateId: q.stateId, districtId: q.districtId, blockId: q.blockId, courseId: q.courseId, q: q.q, view: view === "map" ? "map" : undefined }} />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="text-sm text-muted" aria-live="polite">
              {view === "list" ? (
                <Suspense fallback={<span aria-hidden className="inline-block h-4 w-52 animate-pulse rounded bg-line/70 align-middle motion-reduce:animate-none" />}>
                  <ResultCount q={q} hasFilter={hasFilter} />
                </Suspense>
              ) : (
                "Interactive map of all active training centers"
              )}
            </p>

            {/* Sliding indicator: a soft navy pill that travels between the two tabs. */}
            <div className="relative inline-grid w-full grid-cols-2 rounded-xl border border-line/70 bg-white p-1 shadow-card sm:w-auto" role="tablist" aria-label="Results view">
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-navy transition-transform duration-300 ease-out motion-reduce:transition-none",
                  view === "map" && "translate-x-full"
                )}
              />
              <Link href={`/training-centers${buildQuery({ ...baseParams })}`} role="tab" aria-selected={view === "list"} className={tab(view === "list")}>
                <List className="h-4 w-4" aria-hidden /> List
              </Link>
              <Link href={`/training-centers${buildQuery({ ...baseParams, view: "map" })}`} role="tab" aria-selected={view === "map"} className={tab(view === "map")}>
                <MapIcon className="h-4 w-4" aria-hidden /> Map view
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-lavender pb-16 sm:pb-20">
        <SectionBg variant="dots" tone="light" className="opacity-60" />
        <div className="container-x relative z-10">
          {view === "map" ? (
            <CenterMap filters initialFilter={{ stateId: q.stateId, districtId: q.districtId, blockId: q.blockId, courseId: q.courseId }} height={520} />
          ) : (
            <Suspense key={resultsKey} fallback={<CenterGridSkeleton count={Math.min(q.limit, 8)} />}>
              <CenterResults q={q} states={states} user={user} />
            </Suspense>
          )}
        </div>
      </section>

      {states.length > 0 && (
        <section className="relative overflow-hidden bg-white py-14 sm:py-16" aria-labelledby="browse-states-title">
          <SectionBg variant="grid" tone="light" className="opacity-70" />
          <div className="container-x relative z-10">
            <Reveal>
              <p className="eyebrow mb-3">Browse by state</p>
              <h2 id="browse-states-title" className="font-heading text-2xl font-extrabold text-navy sm:text-3xl">
                States with active training centers
              </h2>
              <ul className="mt-6 flex flex-wrap gap-2.5">
                {states.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/training-centers/${s.slug}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-navy transition-all duration-200 hover:-translate-y-0.5 hover:border-orange hover:text-orange hover:shadow-card motion-reduce:transform-none motion-reduce:transition-none sm:min-h-10"
                    >
                      {s.name}
                      <span className="rounded-full bg-lavender px-2 py-0.5 text-xs text-navy tabular-nums">{s.centerCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      )}

      <CtaBand title="No center nearby [[yet]]?" description="Register anyway – we notify students when a new center opens in their district, and volunteers can help us start one." primary={{ label: "Register as a Student", href: "/register" }} secondary={{ label: "Volunteer as a Trainer", href: "/become-a-trainer" }} />
    </>
  );
}
