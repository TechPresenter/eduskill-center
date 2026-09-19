import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { PageHero } from "@/components/site/page-hero";
import { SafeImage } from "@/components/site/safe-image";
import { markdownExcerpt } from "@/components/site/markdown";
import { Reveal } from "@/components/site/reveal";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming and past events from EduSkill India Foundation – skill melas, open houses, trainer meets and community programs.",
  alternates: { canonical: absoluteUrl("/events") },
  openGraph: { title: "Events", description: "Upcoming and past EduSkill events.", url: absoluteUrl("/events"), type: "website" },
};

function EventCard({ e }: { e: { id: string; slug: string; title: string; summary: string | null; content: string | null; image: string | null; startAt: Date; endAt: Date | null; location: string | null; state: { name: string } | null; district: { name: string } | null }; }) {
  const upcoming = (e.endAt ?? e.startAt) >= new Date();
  const day = formatDate(e.startAt, "dd");
  const month = formatDate(e.startAt, "MMM yyyy");
  const place = e.location || [e.district?.name, e.state?.name].filter(Boolean).join(", ");
  return (
    <article className="card card-hover flex h-full flex-col overflow-hidden">
      <Link href={`/events/${e.slug}`} className="relative block h-44 bg-lavender" aria-hidden tabIndex={-1}>
        {e.image ? (
          <SafeImage src={e.image} alt="" sizes="(max-width: 768px) 100vw, 33vw" />
        ) : (
          <span className="flex h-full items-center justify-center">
            <CalendarDays className="h-10 w-10 text-navy/40" />
          </span>
        )}
        <span className="absolute top-3 left-3 flex flex-col items-center rounded-xl bg-white px-3 py-1.5 text-navy shadow-card">
          <span className="font-heading text-xl font-extrabold leading-none">{day}</span>
          <span className="text-[10px] font-semibold tracking-wide uppercase">{month}</span>
        </span>
        {upcoming && <Badge tone="orange" className="absolute top-3 right-3 bg-white">Upcoming</Badge>}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-bold leading-snug text-navy">
          <Link href={`/events/${e.slug}`} className="hover:text-orange">
            {e.title}
          </Link>
        </h2>
        <p className="mt-2 flex-1 text-sm text-muted">{e.summary || markdownExcerpt(e.content, 120)}</p>
        <p className="mt-4 flex flex-col gap-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-orange" aria-hidden />
            {formatDate(e.startAt, "dd MMM yyyy, hh:mm a")}
            {e.endAt && e.endAt.getTime() !== e.startAt.getTime() ? ` – ${formatDate(e.endAt, "dd MMM yyyy")}` : ""}
          </span>
          {place && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-orange" aria-hidden /> {place}
            </span>
          )}
        </p>
      </div>
    </article>
  );
}

export default async function EventsPage() {
  const now = new Date();
  const events = await db.event.findMany({ where: { status: "PUBLISHED" }, orderBy: { startAt: "desc" }, include: { state: { select: { name: true } }, district: { select: { name: true } } } });
  const upcoming = events.filter((e) => (e.endAt ?? e.startAt) >= now).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const past = events.filter((e) => (e.endAt ?? e.startAt) < now);

  return (
    <>
      <PageHero compact eyebrow="Events" title="Meet Us [[In Person]]" description="Skill melas, open houses, trainer meets and community programs across our centers." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Events" }]} />
      <section className="bg-lavender py-14 sm:py-20">
        <div className="container-x space-y-14">
          <div>
            <h2 className="mb-6 text-2xl font-extrabold text-navy">Upcoming events</h2>
            {upcoming.length === 0 ? (
              <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="No upcoming events" description="Follow us or check back soon for new events." />
            ) : (
              <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((e, i) => (
                  <Reveal as="li" key={e.id} delay={Math.min(i, 5) * 60}>
                    <EventCard e={e} />
                  </Reveal>
                ))}
              </ul>
            )}
          </div>
          {past.length > 0 && (
            <div>
              <h2 className="mb-6 text-2xl font-extrabold text-navy">Past events</h2>
              <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {past.map((e) => (
                  <li key={e.id}>
                    <EventCard e={e} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
