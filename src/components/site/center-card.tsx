import Link from "next/link";
import { Armchair, BadgeCheck, GraduationCap, MapPin, Navigation, Users } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
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

/** One compact stat. Kept tiny so four cards fit comfortably across a desktop row. */
function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className="h-4 w-4 text-orange" aria-hidden />
      <span className="font-heading text-base leading-none font-extrabold text-navy tabular-nums">{value}</span>
      <span className="text-caption font-semibold tracking-wide text-muted uppercase">{label}</span>
    </div>
  );
}

/**
 * A training centre in the public list.
 *
 * Sized for a four-across desktop grid, so everything earns its place: the banner carries the
 * identity (initials, code, verification) and nothing else, and the name, address and code each
 * appear exactly once.
 */
export function CenterCard({ center, applyHref }: { center: CenterCardData; applyHref: string }) {
  const url = centerUrl(center);
  const courses = center.courses.map((c) => c.course);
  const shown = courses.slice(0, 3);
  const extra = courses.length - shown.length;
  const mark = initials(center.name.replace(/^eduskill\s+/i, "")) || "TC";

  return (
    <article className="group card card-hover relative flex h-full flex-col overflow-hidden">
      {/* Identity banner. The generated cover art is nothing but the centre name and code rendered
          into a gradient, so at this size it only ghosts through behind the chips and repeats the
          heading — the banner is drawn instead, and the artwork is left to the detail page. */}
      {/* A fixed-height identity strip, deliberately not a `media` frame: it carries initials, never a photo. */}
      <div className="relative h-24 overflow-hidden bg-navy">
        <span aria-hidden className="absolute inset-0 bg-linear-to-br from-navy via-navy to-navy-dark" />
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "14px 14px" }}
        />
        {/* Soft brand glow, purely decorative: radial gradients, no blur pass. */}
        <span aria-hidden className="absolute -right-10 -bottom-14 h-36 w-36 rounded-full bg-[radial-gradient(closest-side,rgb(232_82_10/0.28),transparent)]" />
        <span aria-hidden className="absolute -top-12 -left-8 h-32 w-32 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.12),transparent)]" />

        <div className="relative flex h-full items-center gap-3 px-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white/12 font-heading text-sm font-extrabold text-white ring-1 ring-white/25">
            {mark}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-mono text-caption font-semibold tracking-wider text-white/85">{center.code}</span>
            {center.isVerified && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-caption font-bold tracking-wide text-white uppercase ring-1 ring-white/25">
                <BadgeCheck className="h-3 w-3" aria-hidden /> Verified
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-h4 text-navy">
          <Link href={url} className="transition-colors after:absolute after:inset-0 hover:text-orange focus-visible:text-orange">
            {center.name}
          </Link>
        </h3>

        <p className="mt-1.5 flex items-start gap-1.5 text-body-sm text-muted">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange" aria-hidden />
          <span className="min-w-0">
            <span className="block font-medium text-ink">
              {center.block.name}, {center.district.name}
            </span>
            <span className="block truncate text-xs">
              {center.state.name} · {center.pincode}
            </span>
          </span>
        </p>

        {shown.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1" aria-label="Courses offered">
            {shown.map((c) => (
              <li key={c.id} className="inline-flex rounded-full bg-lavender px-2 py-0.5 text-caption font-semibold text-navy">
                {c.name}
              </li>
            ))}
            {extra > 0 && <li className="inline-flex rounded-full bg-surface px-2 py-0.5 text-caption font-bold text-muted">+{extra}</li>}
          </ul>
        )}

        <dl className="mt-auto grid grid-cols-3 gap-1 border-t border-line pt-3 pb-3">
          <Stat icon={GraduationCap} label="Trainers" value={center.trainerCount} />
          <Stat icon={Users} label="Students" value={center.studentCount} />
          <Stat icon={Armchair} label="Seats" value={center.availableSeats} />
        </dl>

        {/* Raised above the title's stretched link so both remain clickable. */}
        <div className="relative z-10 grid grid-cols-2 gap-2">
          <ButtonLink href={applyHref} size="sm" className="col-span-2">
            Apply Now
          </ButtonLink>
          <ButtonLink href={url} variant="outline" size="sm">
            Details
          </ButtonLink>
          <a
            href={directionsUrl(center)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            <Navigation className="h-3.5 w-3.5 text-orange" aria-hidden /> Directions
          </a>
        </div>
      </div>
    </article>
  );
}

/** The slim centre shape the home rail uses (what `listHomeCenters()` returns). */
export interface CenterRailItem {
  id: string;
  code: string;
  name: string;
  verified: boolean;
  location: string;
  courses: string[];
  url: string;
}

/**
 * Thumb-sized centre card for the phone home screen's swipe rail: identity, place and up to two
 * courses. The whole card is one link to the centre page (Apply and Directions live there).
 */
export function CenterCardCompact({ center }: { center: CenterRailItem }) {
  const mark = initials(center.name.replace(/^eduskill\s+/i, "")) || "TC";
  const shown = center.courses.slice(0, 2);
  const extra = center.courses.length - shown.length;
  return (
    <article className="card relative flex h-full flex-col p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-navy font-heading text-sm font-extrabold text-white">
          {mark}
        </span>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-h4 text-navy">
            <Link href={center.url} className="ring-focus after:absolute after:inset-0 after:rounded-card">
              {center.name}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-caption text-muted">
            <span className="font-mono">{center.code}</span>
            {center.verified && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-success-dark">
                <BadgeCheck className="size-3.5" aria-hidden /> Verified
              </span>
            )}
          </p>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-body-sm text-muted">
        <MapPin className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />
        <span className="line-clamp-2">{center.location}</span>
      </p>
      {shown.length > 0 && (
        <ul className="mt-auto flex flex-wrap gap-1 pt-3" aria-label="Courses offered">
          {shown.map((name) => (
            <li key={name} className="max-w-full truncate rounded-full bg-lavender px-2 py-0.5 text-caption font-semibold text-navy">
              {name}
            </li>
          ))}
          {extra > 0 && <li className="rounded-full bg-surface px-2 py-0.5 text-caption font-bold text-muted">+{extra}</li>}
        </ul>
      )}
    </article>
  );
}
