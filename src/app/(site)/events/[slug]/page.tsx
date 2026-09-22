import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { Media } from "@/components/site/safe-image";
import { SectionBg } from "@/components/site/decor";
import { Markdown, markdownExcerpt } from "@/components/site/markdown";
import { JsonLd } from "@/components/site/json-ld";

type Props = { params: Promise<{ slug: string }> };

async function loadEvent(slug: string) {
  return db.event.findFirst({ where: { slug, status: "PUBLISHED" }, include: { state: { select: { name: true } }, district: { select: { name: true } } } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const e = await loadEvent(slug);
  if (!e) return { title: "Event not found" };
  const description = e.summary || markdownExcerpt(e.content);
  const url = absoluteUrl(`/events/${e.slug}`);
  return { title: e.title, description, alternates: { canonical: url }, openGraph: { title: e.title, description, url, type: "article", images: e.image ? [{ url: e.image }] : undefined } };
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params;
  const [e, branding] = await Promise.all([loadEvent(slug), getBranding()]);
  if (!e) notFound();
  const upcoming = (e.endAt ?? e.startAt) >= new Date();
  const place = e.location || [e.district?.name, e.state?.name].filter(Boolean).join(", ");
  const safeRegistration = e.registrationUrl && /^https?:\/\//i.test(e.registrationUrl) ? e.registrationUrl : null;
  const ends = e.endAt && e.endAt.getTime() !== e.startAt.getTime() ? ` – ${formatDate(e.endAt, "dd MMM yyyy")}` : "";

  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Event", name: e.title, description: e.summary ?? markdownExcerpt(e.content), startDate: e.startAt.toISOString(), endDate: (e.endAt ?? e.startAt).toISOString(), eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: place ? { "@type": "Place", name: place, address: { "@type": "PostalAddress", addressLocality: e.district?.name, addressRegion: e.state?.name, addressCountry: "IN" } } : undefined, image: e.image ?? undefined, organizer: { "@type": "Organization", name: branding.siteName, url: absoluteUrl("/") }, url: absoluteUrl(`/events/${e.slug}`) }} />

      <PageHero compact eyebrow={upcoming ? "Upcoming event" : "Past event"} title={e.title} description={e.summary ?? undefined} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Events", href: "/events" }, { label: e.title }]}>
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body text-white/85">
          <div className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-orange" aria-hidden />
            <dt className="sr-only">Date and time</dt>
            <dd>
              {formatDate(e.startAt, "EEEE, dd MMM yyyy · hh:mm a")}
              {ends}
            </dd>
          </div>
          {place && (
            <div className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-orange" aria-hidden />
              <dt className="sr-only">Location</dt>
              <dd>{place}</dd>
            </div>
          )}
          {upcoming && <Badge tone="orange">Upcoming</Badge>}
        </dl>
      </PageHero>

      <section className="relative overflow-x-clip bg-surface section-y">
        <SectionBg variant="grid" />
        <div className="container-x relative z-10">
          <article className="mx-auto max-w-3xl">
            {/* Same 16/9 frame the listing card uses, so the photo you clicked is the photo you get. */}
            {/* Only when the event actually has a photo. A 16/9 band of abstract pattern is a
                photo-shaped hole on a page this wide; without one, the type carries the page. */}
            {e.image && (
              <div className="rounded-card-lg shadow-e1">
                <Media src={e.image} alt={e.title} seed={e.slug} ratio="16x9" priority sizes="(max-width: 768px) 100vw, 768px" />
              </div>
            )}

            <div className={cn("card rounded-card-lg p-6 sm:p-10", e.image && "mt-8")}>
              {e.content ? <Markdown source={e.content} /> : <p className="text-body-lg text-muted">{e.summary}</p>}

              {safeRegistration && upcoming && (
                <div className="mt-8 border-t border-line pt-6">
                  <ButtonLink href={safeRegistration} size="lg" target="_blank" rel="noopener noreferrer" rightIcon={<ExternalLink className="h-4 w-4" />}>
                    Register for this event
                  </ButtonLink>
                  <p className="mt-2 text-caption text-muted">Opens the registration form in a new tab.</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/events" className="ring-focus inline-flex min-h-11 items-center gap-2 rounded-md text-body-sm font-semibold text-orange hover:underline underline-offset-4">
                <ArrowLeft className="h-4 w-4" aria-hidden /> All events
              </Link>
              <ButtonLink href="/training-centers" variant="outline">
                Find a training centre
              </ButtonLink>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
