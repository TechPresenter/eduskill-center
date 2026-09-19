import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl } from "@/lib/utils";
import { SitePagination } from "@/components/site/pagination";
import { searchCenters } from "@/server/centers";
import { getStateBySlug, listDistrictsWithCenters } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { CenterCard } from "@/components/site/center-card";
import { CtaBand } from "@/components/site/cta-band";
import { applyHref } from "@/components/site/apply-link";
import { EmptyState } from "@/components/ui/feedback";

type Props = { params: Promise<{ state: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const st = await getStateBySlug(state);
  if (!st) return { title: "State not found" };
  const title = `Training Centers in ${st.name}`;
  const description = `Find EduSkill training centers in ${st.name} by district and block. Verified centers, courses offered, trainers and seat availability.`;
  return { title, description, alternates: { canonical: absoluteUrl(`/training-centers/${st.slug}`) }, openGraph: { title, description, url: absoluteUrl(`/training-centers/${st.slug}`), type: "website" } };
}

export default async function StateCentersPage({ params, searchParams }: Props) {
  const { state } = await params;
  const sp = await searchParams;
  const st = await getStateBySlug(state);
  if (!st) notFound();
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const [districts, result, user] = await Promise.all([listDistrictsWithCenters(st.id), searchCenters({ state: st.slug, page, limit: 24 }), getSessionUser().catch(() => null)]);

  return (
    <>
      <PageHero
        eyebrow="Training Centers"
        title={`EduSkill Centers in [[${st.name}]]`}
        description={`${result.meta.total} active training center${result.meta.total === 1 ? "" : "s"} across ${districts.length} district${districts.length === 1 ? "" : "s"} in ${st.name}.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Training Centers", href: "/training-centers" }, { label: st.name }]}
        compact
      />

      {districts.length > 0 && (
        <section className="bg-lavender py-10" aria-labelledby="districts-title">
          <div className="container-x">
            <h2 id="districts-title" className="text-lg font-extrabold text-navy">
              Districts with centers
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {districts.map((d) => (
                <li key={d.id}>
                  <Link href={`/training-centers/${st.slug}/${d.slug}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:border-orange hover:text-orange">
                    {d.name}
                    <span className="rounded-full bg-lavender px-2 py-0.5 text-xs">{d.centerCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="bg-white py-14 sm:py-16">
        <div className="container-x">
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-extrabold text-navy">
            <Building2 className="h-6 w-6 text-orange" aria-hidden /> All centers in {st.name}
          </h2>
          {result.items.length === 0 ? (
            <EmptyState title="No active centers yet" description={`We do not have a verified training center in ${st.name} at the moment.`} action={<Link href="/training-centers" className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white">Browse all centers <ArrowRight className="h-4 w-4" /></Link>} />
          ) : (
            <>
              <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {result.items.map((c) => (
                  <li key={c.id}>
                    <CenterCard center={c} applyHref={applyHref(user, { centerId: c.id })} />
                  </li>
                ))}
              </ul>
              <SitePagination page={result.meta.page} totalPages={result.meta.totalPages} total={result.meta.total} limit={result.meta.limit} hrefFor={(p) => `/training-centers/${st.slug}${p > 1 ? `?page=${p}` : ""}`} className="mt-10" />
            </>
          )}
        </div>
      </section>

      <CtaBand title={`Learn a skill in [[${st.name}]]`} description="Register today and apply to the center closest to you. Scholarship support is available for eligible students." primary={{ label: "Apply Now", href: applyHref(user) }} secondary={{ label: "Browse Courses", href: "/courses" }} />
    </>
  );
}
