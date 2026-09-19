import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl } from "@/lib/utils";
import { EmptyState } from "@/components/ui/feedback";
import { searchCenters } from "@/server/centers";
import { getDistrictBySlug } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { CenterCard } from "@/components/site/center-card";
import { CenterMap } from "@/components/site/center-map";
import { CtaBand } from "@/components/site/cta-band";
import { applyHref } from "@/components/site/apply-link";

type Props = { params: Promise<{ state: string; district: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, district } = await params;
  const d = await getDistrictBySlug(state, district);
  if (!d) return { title: "District not found" };
  const title = `Training Centers in ${d.name}, ${d.state.name}`;
  const description = `EduSkill training centers in ${d.name} district, ${d.state.name}: address, courses offered, trainers, seats and directions.`;
  const url = absoluteUrl(`/training-centers/${d.state.slug}/${d.slug}`);
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: "website" } };
}

export default async function DistrictCentersPage({ params }: Props) {
  const { state, district } = await params;
  const d = await getDistrictBySlug(state, district);
  if (!d) notFound();
  const [result, user] = await Promise.all([searchCenters({ state: d.state.slug, district: d.slug, page: 1, limit: 50 }), getSessionUser().catch(() => null)]);
  const markers = result.items
    .filter((c) => c.latitude !== null && c.longitude !== null)
    .map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      lat: c.latitude as number,
      lng: c.longitude as number,
      verified: c.isVerified,
      location: [c.villageTown, c.block.name, c.district.name, c.state.name].filter(Boolean).join(", "),
      courses: c.courses.map((x) => x.course.name),
      url: `/training-centers/${c.state.slug}/${c.district.slug}/${c.slug}`,
    }));

  return (
    <>
      <PageHero
        eyebrow="Training Centers"
        title={`Centers in [[${d.name}]], ${d.state.name}`}
        description={`${result.meta.total} active training center${result.meta.total === 1 ? "" : "s"} in ${d.name} district.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Training Centers", href: "/training-centers" }, { label: d.state.name, href: `/training-centers/${d.state.slug}` }, { label: d.name }]}
        compact
      />

      <section className="bg-lavender py-14 sm:py-16">
        <div className="container-x">
          {result.items.length === 0 ? (
            <EmptyState title="No active centers yet" description={`We do not have a verified training center in ${d.name} at the moment.`} action={<Link href={`/training-centers/${d.state.slug}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white">Other centers in {d.state.name} <ArrowRight className="h-4 w-4" /></Link>} />
          ) : (
            <div className="grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <h2 className="mb-6 flex items-center gap-2 text-2xl font-extrabold text-navy">
                  <Building2 className="h-6 w-6 text-orange" aria-hidden /> Centers in {d.name}
                </h2>
                <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {result.items.map((c) => (
                    <li key={c.id}>
                      <CenterCard center={c} applyHref={applyHref(user, { centerId: c.id })} />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-5">
                <div className="lg:sticky lg:top-24">
                  <h2 className="mb-6 text-2xl font-extrabold text-navy">On the map</h2>
                  <CenterMap initialCenters={markers} height={440} listTitle={`Centers in ${d.name}`} />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <CtaBand title={`Start learning in [[${d.name}]]`} description="Apply to a center in your district – our team will confirm your batch and guide you through admission." primary={{ label: "Apply Now", href: applyHref(user) }} secondary={{ label: "Browse Courses", href: "/courses" }} />
    </>
  );
}
