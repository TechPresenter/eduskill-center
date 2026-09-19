import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "@/components/site/page-hero";
import { SafeImage } from "@/components/site/safe-image";
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

  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Event", name: e.title, description: e.summary ?? markdownExcerpt(e.content), startDate: e.startAt.toISOString(), endDate: (e.endAt ?? e.startAt).toISOString(), eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: place ? { "@type": "Place", name: place, address: { "@type": "PostalAddress", addressLocality: e.district?.name, addressRegion: e.state?.name, addressCountry: "IN" } } : undefined, image: e.image ?? undefined, organizer: { "@type": "Organization", name: branding.siteName, url: absoluteUrl("/") }, url: absoluteUrl(`/events/${e.slug}`) }} />
      <PageHero compact eyebrow={upcoming ? "Upcoming event" : "Past event"} title={e.title} description={e.summary ?? undefined} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Events", href: "/events" }, { label: e.title }]}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/85">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-orange" aria-hidden />
            {formatDate(e.startAt, "EEEE, dd MMM yyyy · hh:mm a")}
            {e.endAt && e.endAt.getTime() !== e.startAt.getTime() ? ` – ${formatDate(e.endAt, "dd MMM yyyy")}` : ""}
          </span>
          {place && (
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange" aria-hidden /> {place}
            </span>
          )}
          {upcoming && <Badge tone="orange">Upcoming</Badge>}
        </div>
      </PageHero>
      <article className="container-x py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          {e.image && (
            <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-card-lg bg-lavender">
              <SafeImage src={e.image} alt={e.title} priority sizes="(max-width: 768px) 100vw, 768px" />
            </div>
          )}
          {e.content ? <Markdown source={e.content} /> : <p className="text-muted">{e.summary}</p>}
          {safeRegistration && upcoming && (
            <a href={safeRegistration} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-orange px-6 text-base font-semibold text-white shadow-sm hover:bg-orange-hover">
              Register for this event <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          )}
          <div className="mt-10 border-t border-line pt-6">
            <Link href="/events" className="inline-flex items-center gap-2 text-sm font-semibold text-orange">
              <ArrowLeft className="h-4 w-4" aria-hidden /> All events
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
