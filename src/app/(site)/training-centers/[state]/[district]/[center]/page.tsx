import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Armchair, BadgeCheck, CalendarDays, Clock, GraduationCap, Images, Mail, MapPin, MessageCircle, Navigation, Phone, Users } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, formatDate, formatINR, initials, titleCase } from "@/lib/utils";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/misc";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { getPublicCenter } from "@/server/centers";
import { PageHero } from "@/components/site/page-hero";
import { SafeImage } from "@/components/site/safe-image";
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
          {c.establishedOn && <span className="text-sm text-white/70">Established {formatDate(c.establishedOn, "MMM yyyy")}</span>}
        </div>
      </PageHero>

      <section className="container-x -mt-8 relative z-10">
        <div className="relative aspect-[21/9] overflow-hidden rounded-card-lg bg-navy shadow-card">
          {c.coverImage ? (
            <SafeImage src={c.coverImage} alt={c.name} priority sizes="(max-width: 1280px) 100vw, 1200px" />
          ) : (
            <div className="flex h-full items-center justify-center bg-linear-to-br from-navy to-navy-light">
              <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/10 font-heading text-4xl font-extrabold text-white ring-1 ring-white/20">{initials(c.name.replace(/^eduskill\s+/i, "")) || "TC"}</span>
            </div>
          )}
        </div>
      </section>

      <section className="container-x grid gap-10 py-12 lg:grid-cols-12 lg:py-16">
        <div className="space-y-12 lg:col-span-8">
          {c.description && (
            <div>
              <h2 className="mb-3 text-2xl font-extrabold text-navy">About the center</h2>
              <p className="text-[15.5px] leading-7 text-ink">{c.description}</p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Students", value: c.studentCount, icon: Users },
              { label: "Trainers", value: c.trainerCount, icon: GraduationCap },
              { label: "Capacity", value: c.capacity, icon: Armchair },
              { label: "Seats open", value: c.availableSeats, icon: CalendarDays },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <s.icon className="mx-auto h-5 w-5 text-orange" aria-hidden />
                <dd className="mt-1 font-heading text-2xl font-extrabold text-navy">{s.value}</dd>
                <dt className="text-xs font-semibold text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>

          <div>
            <h2 className="mb-4 text-2xl font-extrabold text-navy">Courses offered</h2>
            {c.courses.length === 0 ? (
              <p className="card p-6 text-sm text-muted">Courses for this center will be published soon.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {c.courses.map(({ course }) => (
                  <li key={course.id} className="card card-hover flex gap-4 p-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-light text-orange">
                      <DynamicIcon name={course.icon ?? undefined} className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-navy">
                        <Link href={`/courses/${course.slug}`} className="hover:text-orange">
                          {course.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        {course.durationText} · {titleCase(course.level)} · {titleCase(course.mode)}
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-sm">
                        <span className="font-semibold text-navy">{Number(course.courseFee) > 0 ? formatINR(course.courseFee) : "Free"}</span>
                        {course.scholarshipAvailable && <Badge tone="orange">Scholarship</Badge>}
                      </p>
                      <Link href={applyHref(user, { centerId: c.id, courseId: course.id })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange">
                        Apply for this course <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-extrabold text-navy">Open batches</h2>
            {c.batches.length === 0 ? (
              <p className="card p-6 text-sm text-muted">No upcoming or ongoing batches are listed right now. Apply and we will place you in the next batch.</p>
            ) : (
              <>
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
                          <Link href={`/courses/${b.course.slug}`} className="hover:text-orange">
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
                          <span className={b.available > 0 ? "font-semibold text-success" : "font-semibold text-danger"}>{b.available}</span>
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
                    <li key={b.id} className="card p-4 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-navy">{b.name}</p>
                          <p className="text-xs text-muted">{b.course.name}</p>
                        </div>
                        <StatusBadge status={b.status} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <dt className="text-muted">Dates</dt>
                          <dd className="font-medium text-ink">
                            {formatDate(b.startDate)} – {formatDate(b.endDate)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Time</dt>
                          <dd className="font-medium text-ink">
                            {b.days.join(", ")} · {b.startTime}–{b.endTime}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Seats available</dt>
                          <dd className="font-medium text-ink">
                            {b.available} / {b.capacity}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Trainer</dt>
                          <dd className="font-medium text-ink">{b.trainerName ?? "To be assigned"}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {c.trainers.length > 0 && (
            <div>
              <h2 className="mb-4 text-2xl font-extrabold text-navy">Trainers</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {c.trainers.map((t) => (
                  <li key={t.id} className="card flex items-start gap-4 p-5">
                    <Avatar name={t.name} src={t.avatarUrl} size={48} />
                    <div className="min-w-0">
                      <p className="font-bold text-navy">{t.name}</p>
                      <p className="text-xs text-muted">
                        {titleCase(t.level)} level trainer · {t.trainerId}
                        {t.course ? ` · ${t.course}` : ""}
                      </p>
                      {t.skills.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {t.skills.slice(0, 5).map((s) => (
                            <li key={s} className="rounded-full bg-lavender px-2 py-0.5 text-[11px] font-medium text-navy">
                              {s}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {c.facilities.length > 0 && (
            <div>
              <h2 className="mb-4 text-2xl font-extrabold text-navy">Facilities</h2>
              <ul className="flex flex-wrap gap-2">
                {c.facilities.map((f) => (
                  <li key={f} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-ink">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {c.gallery.length > 0 && (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-navy">
                <Images className="h-6 w-6 text-orange" aria-hidden /> Gallery
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {c.gallery.map((g) => (
                  <li key={g.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-lavender">
                    <SafeImage src={g.url} alt={g.caption ?? `${c.name} photo`} sizes="(max-width: 640px) 50vw, 33vw" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4">
          <div className="sticky top-24 space-y-6">
            <div className="card p-6">
              <ButtonLink href={apply} fullWidth size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Apply for Admission
              </ButtonLink>
              <a href={directionsUrl(c)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink transition-all hover:border-navy/40 hover:bg-surface">
                <Navigation className="h-4 w-4 text-orange" aria-hidden /> Get Directions
              </a>
              <address className="mt-5 space-y-3 text-sm not-italic">
                <p className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4.5 w-4.5 shrink-0 text-orange" aria-hidden />
                  <span className="text-ink">{fullAddress}</span>
                </p>
                {c.phone && (
                  <p className="flex items-center gap-3">
                    <Phone className="h-4.5 w-4.5 shrink-0 text-orange" aria-hidden />
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="text-ink hover:text-orange">
                      {c.phone}
                    </a>
                  </p>
                )}
                {waHref && (
                  <p className="flex items-center gap-3">
                    <MessageCircle className="h-4.5 w-4.5 shrink-0 text-orange" aria-hidden />
                    <a href={waHref} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-orange">
                      WhatsApp {c.whatsapp}
                    </a>
                  </p>
                )}
                {c.email && (
                  <p className="flex items-center gap-3">
                    <Mail className="h-4.5 w-4.5 shrink-0 text-orange" aria-hidden />
                    <a href={`mailto:${c.email}`} className="break-all text-ink hover:text-orange">
                      {c.email}
                    </a>
                  </p>
                )}
              </address>
              {hours.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
                    <Clock className="h-4 w-4 text-orange" aria-hidden /> Opening hours
                  </h2>
                  <dl className="mt-2 space-y-1 text-sm">
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
    </>
  );
}
