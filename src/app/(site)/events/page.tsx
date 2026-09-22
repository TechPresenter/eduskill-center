import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHero } from "@/components/site/page-hero";
import { Media } from "@/components/site/safe-image";
import { markdownExcerpt } from "@/components/site/markdown";
import { SectionBg } from "@/components/site/decor";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming and past events from EduSkill India Foundation – skill melas, open houses, trainer meets and community programs.",
  alternates: { canonical: absoluteUrl("/events") },
  openGraph: { title: "Events", description: "Upcoming and past EduSkill events.", url: absoluteUrl("/events"), type: "website" },
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string | null;
  image: string | null;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  state: { name: string } | null;
  district: { name: string } | null;
};

/**
 * One event.
 *
 * The cover is the shared `media media-16x9` frame — the same ratio the detail page uses, so a
 * photograph is never cropped two different ways, and an event with no photo (the usual case)
 * gets the branded placeholder in an identical box instead of a grey band.
 *
 * One stretched link covers the whole card, so there is a single tab stop and a single announcement
 * per event rather than the image and the heading both linking to the same place.
 */
function EventCard({ e, past }: { e: EventRow; past?: boolean }) {
  const day = formatDate(e.startAt, "dd");
  const month = formatDate(e.startAt, "MMM");
  const year = formatDate(e.startAt, "yyyy");
  const place = e.location || [e.district?.name, e.state?.name].filter(Boolean).join(", ");
  const ends = e.endAt && e.endAt.getTime() !== e.startAt.getTime() ? ` – ${formatDate(e.endAt, "dd MMM yyyy")}` : "";

  return (
    <article className="group card card-hover relative flex h-full flex-col overflow-hidden">
      <div className="rounded-t-card">
        <Media src={e.image} alt={e.image ? e.title : ""} seed={e.slug} ratio="16x9" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className={past ? "opacity-75" : undefined}>
          {/* Torn-off calendar chip: the date is the one fact that decides whether you read on. */}
          <span className="absolute top-3 left-3 flex flex-col items-center rounded-card bg-white px-3 py-2 text-navy shadow-e1">
            <span className="font-heading text-xl font-extrabold leading-none tabular-nums">{day}</span>
            <span className="mt-0.5 text-caption font-bold uppercase">{month}</span>
            <span className="text-caption text-muted tabular-nums">{year}</span>
          </span>
          {!past && <Badge tone="orange" className="absolute top-3 right-3 bg-white">Upcoming</Badge>}
        </Media>
      </div>

      <div className="flex flex-1 flex-col card-p">
        <h3 className="text-h3 text-navy">
          <Link href={`/events/${e.slug}`} className="transition-colors duration-micro after:absolute after:inset-0 hover:text-orange focus-visible:text-orange motion-reduce:transition-none">
            {e.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-body text-muted">{e.summary || markdownExcerpt(e.content, 140)}</p>
        <dl className="mt-4 space-y-1.5 border-t border-line pt-4">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-orange" aria-hidden />
            <dt className="sr-only">Date</dt>
            <dd className="text-body-sm text-muted">
              {formatDate(e.startAt, "dd MMM yyyy, hh:mm a")}
              {ends}
            </dd>
          </div>
          {place && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange" aria-hidden />
              <dt className="sr-only">Location</dt>
              <dd className="text-body-sm text-muted">{place}</dd>
            </div>
          )}
        </dl>
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
      <PageHero
        compact
        eyebrow="Events"
        title="Meet Us [[In Person]]"
        description="Skill melas, open houses, trainer meets and community programs across our centers."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Events" }]}
      />

      <section className="relative overflow-x-clip bg-surface section-y" aria-labelledby="events-upcoming-title">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading
              id="events-upcoming-title"
              label="What's next"
              title="Upcoming [[Events]]"
              description="Entry is free at every event we run. Come with a question — you do not need to register first unless the event says so."
            />
          </Reveal>
          {upcoming.length === 0 ? (
            <EmptyState
              className="mt-10"
              icon={<CalendarDays className="h-7 w-7" />}
              title={past.length > 0 ? "Nothing scheduled right now" : "Our first events are being planned"}
              description={
                past.length > 0
                  ? "The next skill mela or open house has not been announced yet. Past events are listed below, and our centres are open to visitors any working day."
                  : "Skill melas, open houses and trainer meets will be listed here as soon as they are scheduled. Until then, you are welcome to visit any of our training centres."
              }
              action={
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href="/training-centers" variant="navy">
                    Visit a training centre
                  </ButtonLink>
                  <ButtonLink href="/contact" variant="outline">
                    Ask about events
                  </ButtonLink>
                </div>
              }
            />
          ) : (
            <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {upcoming.map((e, i) => (
                <Reveal as="li" key={e.id} delay={Math.min(i, 5) * 60}>
                  <EventCard e={e} />
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>

      {past.length > 0 && (
        <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="events-past-title">
          <SectionBg variant="dots" />
          <div className="container-x relative z-10">
            <Reveal>
              <SectionHeading id="events-past-title" label="Archive" title="Where We've [[Already Been]]" description="Every event we have held, with the photographs and write-ups from the day." />
            </Reveal>
            <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {past.map((e) => (
                <li key={e.id}>
                  <EventCard e={e} past />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand
        title="Can't make it to an [[event]]?"
        description="Our training centres are open on working days. Walk in, meet the trainers and sit in on a class."
        primary={{ label: "Find a Training Center", href: "/training-centers" }}
        secondary={{ label: "Contact Us", href: "/contact" }}
      />
    </>
  );
}
