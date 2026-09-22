import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Armchair, BadgeCheck, CalendarDays, Clock, GraduationCap, Mail, MapPin, MessageCircle, Navigation, Phone, Users } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, formatDate, formatINR, initials, titleCase } from "@/lib/utils";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/misc";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { getPublicCenter } from "@/server/centers";
import { PageHero } from "@/components/site/page-hero";
import { Media } from "@/components/site/safe-image";
import { SectionHeading } from "@/components/site/section-heading";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { CenterMap } from "@/components/site/center-map";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand } from "@/components/site/cta-band";
import { directionsUrl } from "@/components/site/center-card";
import { applyHref } from "@/components/site/apply-link";

type Props = { params: Promise<{ state: string; district: string; center: string }> };

function hoursRows(raw: unknown): { label: string; value: string }[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>).map(([k, v]) => ({
    label: k
      .split(/[_-]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" – "),
    value: typeof v === "string" ? v : typeof v === "object" && v !== null ? Object.values(v as Record<string, unknown>).map(String).join(" – ") : String(v),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, district, center } = await params;
  const c = await getPublicCenter(state, district, center);
  if (!c) return { title: "Center not found" };
  const title = `${c.name} (${c.code})`;
  const description = c.description || `${c.name} – EduSkill training center in ${c.block.name}, ${c.district.name}, ${c.state.name}. Courses, batches, trainers and directions.`;
  const url = absoluteUrl(`/training-centers/${c.state.slug}/${c.district.slug}/${c.slug}`);
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: "website", images: c.coverImage ? [{ url: c.coverImage }] : undefined } };
}

export default async function CenterDetailPage({ params }: Props) {
  const { state, district, center } = await params;
  const c = await getPublicCenter(state, district, center);
  if (!c) notFound();
  const [user, branding] = await Promise.all([getSessionUser().catch(() => null), getBranding()]);
  const url = `/training-centers/${c.state.slug}/${c.district.slug}/${c.slug}`;
  const apply = applyHref(user, { centerId: c.id });
  const hours = hoursRows(c.openingHours);
  const waDigits = (c.whatsapp ?? "").replace(/\D/g, "");
  const waHref = waDigits ? `https://wa.me/${waDigits.length === 10 ? `91${waDigits}` : waDigits}` : null;
  const marker = c.latitude !== null && c.longitude !== null ? [{ id: c.id, code: c.code, name: c.name, lat: c.latitude, lng: c.longitude, verified: c.isVerified, location: `${c.block.name}, ${c.district.name}, ${c.state.name}`, courses: c.courses.map((x) => x.course.name), url }] : [];
  const mark = initials(c.name.replace(/^eduskill\s+/i, "")) || "TC";
  const fullAddress = [c.address, c.landmark ? `near ${c.landmark}` : null, c.villageTown, c.block.name, c.district.name, c.state.name, c.pincode].filter(Boolean).join(", ");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: c.name,
    identifier: c.code,
    url: absoluteUrl(url),
    parentOrganization: { "@type": "NGO", name: branding.siteName, url: absoluteUrl("/") },
    telephone: c.phone ?? undefined,
    email: c.email ?? undefined,
    image: c.coverImage ?? undefined,
    address: { "@type": "PostalAddress", streetAddress: c.address, addressLocality: c.district.name, addressRegion: c.state.name, postalCode: c.pincode, addressCountry: "IN" },
    geo: c.latitude !== null && c.longitude !== null ? { "@type": "GeoCoordinates", latitude: c.latitude, longitude: c.longitude } : undefined,
    openingHours: hours.map((h) => `${h.label}: ${h.value}`),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHero
        compact
        eyebrow={`${c.block.name} · ${c.district.name} · ${c.state.name}`}
        title={c.name}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Training Centers", href: "/training-centers" }, { label: c.state.name, href: `/training-centers/${c.state.slug}` }, { label: c.district.name, href: `/training-centers/${c.state.slug}/${c.district.slug}` }, { label: c.name }]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="navy" className="bg-white">
            {c.code}
          </Badge>
          {c.isVerified ? (
            <Badge tone="success" className="bg-white">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified center
            </Badge>
          ) : (
            <Badge tone="warning" className="bg-white">
              Verification pending
            </Badge>
          )}
          {c.establishedOn && <span className="text-body-sm text-white/80">Established {formatDate(c.establishedOn, "MMM yyyy")}</span>}
        </div>
      </PageHero>

      {/* The banner is a 16/9 media frame — the same ratio the centre's photo gets in a list card —
          capped in height on wide screens so it reads as a banner and never eats the fold. With no
          photograph (the common case) the branded placeholder fills the identical box, so adding one
          later shifts nothing. */}
      <section className="container-x relative z-raised -mt-8 sm:-mt-10">
        <div className="rounded-card-lg shadow-e2">
          <Media
            src={c.coverImage}
            alt={c.coverImage ? `${c.name} training centre` : ""}
            seed={c.slug}
            mark={mark}
            tone="navy"
            ratio="16x9"
            priority
            sizes="(max-width: 1280px) 100vw, 1200px"
            className="max-h-88 sm:max-h-104"
          />
        </div>
      </section>

      <section className="container-x grid gap-10 section-y lg:grid-cols-12 lg:gap-12">
        <div className="space-y-12 lg:col-span-8">
          {c.description && (
            <section aria-labelledby="centre-about-title">
              <SectionHeading id="centre-about-title" title="About the center" />
              <p className="mt-4 text-body-lg text-ink">{c.description}</p>
            </section>
          )}

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Students", value: c.studentCount, icon: Users },
              { label: "Trainers", value: c.trainerCount, icon: GraduationCap },
              { label: "Capacity", value: c.capacity, icon: Armchair },
              { label: "Seats open", value: c.availableSeats, icon: CalendarDays },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <s.icon className="mx-auto h-5 w-5 text-navy/40" aria-hidden />
                <dd className="mt-1.5 text-h2 text-orange tabular-nums">{s.value}</dd>
                <dt className="mt-0.5 text-overline text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>

          <section aria-labelledby="centre-courses-title">
            <SectionHeading id="centre-courses-title" title="Courses offered" />
            {c.courses.length === 0 ? (
              <p className="mt-4 card card-p text-body text-muted">Courses for this center will be published soon.</p>
            ) : (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {c.courses.map(({ course }) => (
                  <li key={course.id} className="card card-hover relative flex gap-4 card-p">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-orange-light text-orange">
                      <DynamicIcon name={course.icon ?? undefined} className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-h4 text-navy">
                        <Link href={`/courses/${course.slug}`} className="ring-focus transition-colors duration-micro after:absolute after:inset-0 after:rounded-card hover:text-orange motion-reduce:transition-none">
                          {course.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-body-sm text-muted">
                        {course.durationText} · {titleCase(course.level)} · {titleCase(course.mode)}
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-navy tabular-nums">{Number(course.courseFee) > 0 ? formatINR(course.courseFee) : "Free"}</span>
                        {course.scholarshipAvailable && <Badge tone="orange">Scholarship</Badge>}
                      </p>
                      <Link href={applyHref(user, { centerId: c.id, courseId: course.id })} className="relative z-10 mt-2 inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-orange ring-focus hover:underline">
                        Apply for this course <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="centre-batches-title">
            <SectionHeading id="centre-batches-title" title="Open batches" />
            {c.batches.length === 0 ? (
              <p className="mt-4 card card-p text-body text-muted">No upcoming or ongoing batches are listed right now. Apply and we will place you in the next batch.</p>
            ) : (
              <div className="mt-6">
                <TableWrap className="hidden md:block">
                  <THead>
                    <tr>
                      <TH>Batch</TH>
                      <TH>Course</TH>
                      <TH>Dates</TH>
                      <TH>Days / time</TH>
                      <TH>Seats</TH>
                      <TH>Trainer</TH>
                      <TH>Status</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {c.batches.map((b) => (
                      <TR key={b.id}>
                        <TD>
                          <span className="font-semibold text-navy">{b.name}</span>
                          <span className="block text-xs text-muted">{b.code}</span>
                        </TD>
                        <TD>
                          <Link href={`/courses/${b.course.slug}`} className="inline-flex min-h-11 items-center hover:text-orange">
                            {b.course.name}
                          </Link>
                        </TD>
                        <TD className="whitespace-nowrap">
                          {formatDate(b.startDate)} – {formatDate(b.endDate)}
                        </TD>
                        <TD>
                          {b.days.join(", ")}
                          <span className="block text-xs text-muted">
                            {b.startTime} – {b.endTime}
                          </span>
                        </TD>
                        <TD>
                          <span className={b.available > 0 ? "font-semibold text-success-dark tabular-nums" : "font-semibold text-danger tabular-nums"}>{b.available}</span>
                          <span className="text-muted"> / {b.capacity}</span>
                        </TD>
                        <TD>{b.trainerName ?? "To be assigned"}</TD>
                        <TD>
                          <StatusBadge status={b.status} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </TableWrap>
                <ul className="space-y-3 md:hidden">
                  {c.batches.map((b) => (
                    <li key={b.id} className="card card-p">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-h4 text-navy">{b.name}</p>
                          <p className="text-body-sm text-muted">{b.course.name}</p>
                        </div>
                        <StatusBadge status={b.status} />
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                        <div>
                          <dt className="text-overline text-muted">Dates</dt>
                          <dd className="mt-0.5 text-body-sm font-medium text-ink">
                            {formatDate(b.startDate)} – {formatDate(b.endDate)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-overline text-muted">Time</dt>
                          <dd className="mt-0.5 text-body-sm font-medium text-ink">
                            {b.days.join(", ")} · {b.startTime}–{b.endTime}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-overline text-muted">Seats available</dt>
                          <dd className={`mt-0.5 text-body-sm font-semibold tabular-nums ${b.available > 0 ? "text-success-dark" : "text-danger"}`}>
                            {b.available} / {b.capacity}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-overline text-muted">Trainer</dt>
                          <dd className="mt-0.5 text-body-sm font-medium text-ink">{b.trainerName ?? "To be assigned"}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {c.trainers.length > 0 && (
            <section aria-labelledby="centre-trainers-title">
              <SectionHeading id="centre-trainers-title" title="Trainers" />
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {c.trainers.map((t) => (
                  <li key={t.id} className="card flex items-start gap-4 card-p">
                    <Avatar name={t.name} src={t.avatarUrl} size={48} />
                    <div className="min-w-0">
                      <p className="text-h4 text-navy">{t.name}</p>
                      <p className="mt-0.5 text-body-sm text-muted">
                        {titleCase(t.level)} level trainer · {t.trainerId}
                        {t.course ? ` · ${t.course}` : ""}
                      </p>
                      {t.skills.length > 0 && (
                        <ul className="mt-2.5 flex flex-wrap gap-1.5">
                          {t.skills.slice(0, 5).map((s) => (
                            <li key={s} className="rounded-full bg-lavender px-2.5 py-1 text-caption text-navy">
                              {s}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.facilities.length > 0 && (
            <section aria-labelledby="centre-facilities-title">
              <SectionHeading id="centre-facilities-title" title="Facilities" />
              <ul className="mt-6 flex flex-wrap gap-2">
                {c.facilities.map((f) => (
                  <li key={f} className="rounded-full border border-line bg-white px-4 py-2 text-body-sm font-medium text-ink">
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.gallery.length > 0 && (
            <section aria-labelledby="centre-gallery-title">
              <SectionHeading id="centre-gallery-title" title="Gallery" />
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {c.gallery.map((g) => (
                  <li key={g.id} className="rounded-card">
                    <Media src={g.url} alt={g.caption ?? `${c.name} photo`} seed={g.id} ratio="4x3" sizes="(max-width: 640px) 50vw, 33vw" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="lg:col-span-4">
          <div className="space-y-6 lg:sticky lg:top-24">
            <div className="card card-p">
              <ButtonLink href={apply} fullWidth size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Apply for Admission
              </ButtonLink>
              <a href={directionsUrl(c)} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "outline", size: "md", fullWidth: true, className: "mt-2" })}>
                <Navigation className="h-4 w-4 text-orange" aria-hidden /> Get Directions
              </a>
              <address className="mt-6 space-y-3 text-body not-italic">
                <p className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4.5 w-4.5 shrink-0 text-orange" aria-hidden />
                  <span className="text-ink">{fullAddress}</span>
                </p>
                {c.phone && (
                  <p className="flex items-center gap-3">
                    <Phone className="h-4.5 w-4.5 shrink-0 text-orange" aria-hidden />
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center text-ink hover:text-orange">
                      {c.phone}
                    </a>
                  </p>
                )}
                {waHref && (
                  <p className="flex items-center gap-3">
                    <MessageCircle className="h-4.5 w-4.5 shrink-0 text-orange" aria-hidden />
                    <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-ink hover:text-orange">
                      WhatsApp {c.whatsapp}
                    </a>
                  </p>
                )}
                {c.email && (
                  <p className="flex items-center gap-3">
                    <Mail className="h-4.5 w-4.5 shrink-0 text-orange" aria-hidden />
                    <a href={`mailto:${c.email}`} className="inline-flex min-h-11 items-center break-all text-ink hover:text-orange">
                      {c.email}
                    </a>
                  </p>
                )}
              </address>
              {hours.length > 0 && (
                <div className="mt-6 border-t border-line pt-5">
                  <h2 className="flex items-center gap-2 text-h4 text-navy">
                    <Clock className="h-4 w-4 shrink-0 text-orange" aria-hidden /> Opening hours
                  </h2>
                  <dl className="mt-3 space-y-1.5 text-body">
                    {hours.map((h) => (
                      <div key={h.label} className="flex justify-between gap-4">
                        <dt className="text-muted">{h.label}</dt>
                        <dd className="font-medium text-ink">{h.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
            {marker.length > 0 && <CenterMap initialCenters={marker} height={280} zoom={14} listTitle="Location" />}
          </div>
        </aside>
      </section>

      <CtaBand title={`Join [[${c.name}]]`} description="Apply online, upload your documents and our team will confirm your seat in the next available batch." primary={{ label: "Apply for Admission", href: apply }} secondary={{ label: "Ask a Question", href: "/contact?type=ADMISSION" }} />
      {/* Phone + tablet conversion bar. StickyActionBar publishes --sticky-bar-h, which the chat
          launcher and the Toaster both offset by, so the three can never sit on top of each other.
          Hidden at lg, where the sidebar CTA is permanently in view. */}
      <StickyActionBar desktop="hidden" innerClassName="justify-between">
        <span className="min-w-0">
          <span className="block text-overline text-muted">Seats open</span>
          <span className="block truncate text-h4 text-navy tabular-nums">
            {c.availableSeats} of {c.capacity}
          </span>
        </span>
        <ButtonLink href={apply} size="md" className="shrink-0" rightIcon={<ArrowRight className="h-4 w-4" />}>
          Apply Now
        </ButtonLink>
      </StickyActionBar>
    </>
  );
}
