import Link from "next/link";
import { Armchair, BadgeCheck, GraduationCap, MapPin, Navigation, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SafeImage } from "@/components/site/safe-image";
import { initials } from "@/lib/utils";

export interface CenterCardData {
  id: string;
  code: string;
  name: string;
  slug: string;
  address: string;
  landmark: string | null;
  villageTown: string | null;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  coverImage: string | null;
  isVerified: boolean;
  status: string;
  state: { name: string; slug: string };
  district: { name: string; slug: string };
  block: { name: string };
  courses: { course: { id: string; name: string; slug: string } }[];
  trainerCount: number;
  studentCount: number;
  availableSeats: number;
}

export function centerUrl(c: { slug: string; state: { slug: string }; district: { slug: string } }) {
  return `/training-centers/${c.state.slug}/${c.district.slug}/${c.slug}`;
}

export function directionsUrl(c: { latitude: number | null; longitude: number | null; address: string; pincode: string; district: { name: string }; state: { name: string } }) {
  const dest = c.latitude !== null && c.longitude !== null ? `${c.latitude},${c.longitude}` : `${c.address}, ${c.district.name}, ${c.state.name} ${c.pincode}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

export function CenterCard({ center, applyHref }: { center: CenterCardData; applyHref: string }) {
  const url = centerUrl(center);
  const courses = center.courses.map((c) => c.course);
  const shown = courses.slice(0, 4);
  const extra = courses.length - shown.length;
  return (
    <article className="card card-hover flex h-full flex-col overflow-hidden">
      <div className="relative h-40 bg-navy">
        {center.coverImage ? (
          <SafeImage src={center.coverImage} alt={center.name} sizes="(max-width: 640px) 100vw, 33vw" />
        ) : (
          <div className="flex h-full items-center justify-center bg-linear-to-br from-navy to-navy-light">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 font-heading text-2xl font-extrabold text-white ring-1 ring-white/20">{initials(center.name.replace(/^eduskill\s+/i, "")) || "TC"}</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge tone="navy" className="bg-white">
            {center.code}
          </Badge>
          {center.isVerified && (
            <Badge tone="success" className="bg-white">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug text-navy">
          <Link href={url} className="hover:text-orange">
            {center.name}
          </Link>
        </h3>
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange" aria-hidden />
          <span>
            <span className="font-medium text-ink">
              {center.block.name}, {center.district.name}, {center.state.name}
            </span>
            <span className="block text-xs">
              {center.address}
              {center.landmark ? `, near ${center.landmark}` : ""} · {center.pincode}
            </span>
          </span>
        </p>
        {shown.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Courses offered">
            {shown.map((c) => (
              <li key={c.id}>
                <Link href={`/courses/${c.slug}`} className="inline-flex rounded-full bg-lavender px-2.5 py-0.5 text-xs font-medium text-navy hover:bg-navy hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
            {extra > 0 && <li className="inline-flex rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">+{extra}</li>}
          </ul>
        )}
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
          <div>
            <dt className="flex items-center justify-center gap-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
              <GraduationCap className="h-3.5 w-3.5 text-orange" aria-hidden /> Trainers
            </dt>
            <dd className="font-heading text-lg font-extrabold text-navy">{center.trainerCount}</dd>
          </div>
          <div>
            <dt className="flex items-center justify-center gap-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
              <Users className="h-3.5 w-3.5 text-orange" aria-hidden /> Students
            </dt>
            <dd className="font-heading text-lg font-extrabold text-navy">{center.studentCount}</dd>
          </div>
          <div>
            <dt className="flex items-center justify-center gap-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
              <Armchair className="h-3.5 w-3.5 text-orange" aria-hidden /> Seats
            </dt>
            <dd className="font-heading text-lg font-extrabold text-navy">{center.availableSeats}</dd>
          </div>
        </dl>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ButtonLink href={url} variant="outline" size="sm">
            View Center
          </ButtonLink>
          <a href={directionsUrl(center)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3.5 text-sm font-semibold text-ink transition-all hover:border-navy/40 hover:bg-surface">
            <Navigation className="h-4 w-4 text-orange" aria-hidden /> Directions
          </a>
          <ButtonLink href={applyHref} size="sm" className="col-span-2">
            Apply Now
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
