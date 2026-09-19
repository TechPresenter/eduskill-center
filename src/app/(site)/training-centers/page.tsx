import type { Metadata } from "next";
import Link from "next/link";
import { List, Map as MapIcon, SearchX } from "lucide-react";
import { getSection } from "@/lib/cms";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl, buildQuery, cn } from "@/lib/utils";
import { stripHighlight } from "@/components/ui/highlight";
import { EmptyState } from "@/components/ui/feedback";
import { SitePagination } from "@/components/site/pagination";
import { centerSearchSchema, type CenterSearchQuery } from "@/lib/validation/centers";
import { searchCenters } from "@/server/centers";
import { listStatesWithCenters } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
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

export default async function TrainingCentersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { q, view } = parseSearch(sp);
  const [section, states, user] = await Promise.all([getSection<HeadingSection>("home.centerSearch"), listStatesWithCenters(), getSessionUser().catch(() => null)]);
  const result = view === "list" ? await searchCenters(q) : null;
  const hasFilter = !!(q.stateId || q.districtId || q.blockId || q.courseId || q.q);
  const baseParams = { stateId: q.stateId, districtId: q.districtId, blockId: q.blockId, courseId: q.courseId, q: q.q };
  const hrefFor = (page: number) => `/training-centers${buildQuery({ ...baseParams, page: page > 1 ? page : undefined })}`;

  return (
    <>
      <PageHero eyebrow={section.label} title={section.title} description={section.description} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Training Centers" }]} />

      <section className="bg-lavender pb-10">
        <div className="container-x">
          <div className="card relative z-10 -mt-8 rounded-card-lg p-5 sm:p-6">
            <CenterSearchForm initial={{ stateId: q.stateId, districtId: q.districtId, blockId: q.blockId, courseId: q.courseId, q: q.q, view: view === "map" ? "map" : undefined }} />
          </div>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted" aria-live="polite">
              {view === "list" && result ? (
                <>
                  <span className="font-semibold text-navy">{result.meta.total}</span> active training center{result.meta.total === 1 ? "" : "s"}
                  {hasFilter ? " match your search" : ""}
                </>
              ) : (
                "Interactive map of all active training centers"
              )}
            </p>
            <div className="inline-flex rounded-xl bg-white p-1 shadow-card" role="tablist" aria-label="View">
              <Link href={`/training-centers${buildQuery({ ...baseParams })}`} role="tab" aria-selected={view === "list"} className={cn("inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors", view === "list" ? "bg-navy text-white" : "text-muted hover:text-navy")}>
                <List className="h-4 w-4" aria-hidden /> List
              </Link>
              <Link href={`/training-centers${buildQuery({ ...baseParams, view: "map" })}`} role="tab" aria-selected={view === "map"} className={cn("inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors", view === "map" ? "bg-navy text-white" : "text-muted hover:text-navy")}>
                <MapIcon className="h-4 w-4" aria-hidden /> Map view
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-lavender pb-16 sm:pb-20">
        <div className="container-x">
          {view === "map" ? (
            <CenterMap filters initialFilter={{ stateId: q.stateId, districtId: q.districtId, blockId: q.blockId, courseId: q.courseId }} height={520} />
          ) : result && result.items.length === 0 ? (
            <EmptyState
              icon={<SearchX className="h-7 w-7" />}
              title="No centers found"
              description={hasFilter ? "Try widening your search – choose only a state, or clear the course and keyword filters." : "Training centers will appear here as soon as they are verified."}
              action={
                hasFilter ? (
                  <Link href="/training-centers" className="inline-flex h-10 items-center rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-dark">
                    Clear filters
                  </Link>
                ) : undefined
              }
            />
          ) : (
            result && (
              <>
                <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {result.items.map((c) => (
                    <li key={c.id}>
                      <CenterCard center={c} applyHref={applyHref(user, { centerId: c.id, courseId: q.courseId })} />
                    </li>
                  ))}
                </ul>
                <SitePagination page={result.meta.page} totalPages={result.meta.totalPages} total={result.meta.total} limit={result.meta.limit} hrefFor={hrefFor} className="mt-10" />
              </>
            )
          )}
        </div>
      </section>

      {states.length > 0 && (
        <section className="bg-white py-14 sm:py-16" aria-labelledby="browse-states-title">
          <div className="container-x">
            <p className="eyebrow mb-3">Browse by state</p>
            <h2 id="browse-states-title" className="text-2xl font-extrabold text-navy sm:text-3xl">
              States with active training centers
            </h2>
            <ul className="mt-6 flex flex-wrap gap-2.5">
              {states.map((s) => (
                <li key={s.id}>
                  <Link href={`/training-centers/${s.slug}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:border-orange hover:text-orange">
                    {s.name}
                    <span className="rounded-full bg-lavender px-2 py-0.5 text-xs text-navy">{s.centerCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand title="No center nearby [[yet]]?" description="Register anyway – we notify students when a new center opens in their district, and volunteers can help us start one." primary={{ label: "Register as a Student", href: "/register" }} secondary={{ label: "Volunteer as a Trainer", href: "/become-a-trainer" }} />
    </>
  );
}
