import Link from "next/link";
import { Armchair, BadgeCheck, GraduationCap, MapPin, Navigation, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
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
      <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">{label}</span>
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
    <article className="group card card-hover relative flex h-full flex-col overflow-hidden transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 focus-within:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none">
      {/* Identity banner. The generated cover art is nothing but the centre name and code rendered
          into a gradient, so at this size it only ghosts through behind the chips and repeats the
          heading — the banner is drawn instead, and the artwork is left to the detail page. */}
      <div className="relative h-24 overflow-hidden bg-navy">
        <span aria-hidden className="absolute inset-0 bg-linear-to-br from-navy via-navy to-navy-dark" />
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "14px 14px" }}
        />
        {/* Soft brand glow, purely decorative. */}
        <span aria-hidden className="absolute -right-6 -bottom-10 h-28 w-28 rounded-full bg-orange/25 blur-2xl" />
        <span aria-hidden className="absolute -top-8 -left-4 h-24 w-24 rounded-full bg-white/10 blur-xl" />

        <div className="relative flex h-full items-center gap-3 px-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 font-heading text-sm font-extrabold text-white ring-1 ring-white/25 backdrop-blur-[2px]">
            {mark}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-mono text-[11px] font-semibold tracking-wider text-white/85">{center.code}</span>
            {center.isVerified && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase ring-1 ring-white/25">
                <BadgeCheck className="h-3 w-3" aria-hidden /> Verified
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-heading text-[15px] leading-snug font-bold text-navy">
          <Link href={url} className="transition-colors after:absolute after:inset-0 hover:text-orange focus-visible:text-orange">
            {center.name}
          </Link>
        </h3>

        <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-muted">
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
              <li key={c.id} className="inline-flex rounded-full bg-lavender px-2 py-0.5 text-[11px] font-semibold text-navy">
                {c.name}
              </li>
            ))}
            {extra > 0 && <li className="inline-flex rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-muted">+{extra}</li>}
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
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink transition-all duration-150 hover:border-navy/40 hover:bg-surface active:scale-[0.97] motion-reduce:active:scale-100"
          >
            <Navigation className="h-3.5 w-3.5 text-orange" aria-hidden /> Directions
          </a>
        </div>
      </div>
    </article>
  );
}
