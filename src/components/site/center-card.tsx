import Link from "next/link";
import { Armchair, BadgeCheck, GraduationCap, MapPin, Navigation, Users } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { SafeImage } from "@/components/site/safe-image";
import { cn, initials } from "@/lib/utils";

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

/** Seeded placeholder art under /media/centers, as opposed to a cover a human uploaded. */
function isGeneratedCover(url: string) {
  return url.startsWith("/media/centers/");
}

export function centerUrl(c: { slug: string; state: { slug: string }; district: { slug: string } }) {
  return `/training-centers/${c.state.slug}/${c.district.slug}/${c.slug}`;
}

export function directionsUrl(c: { latitude: number | null; longitude: number | null; address: string; pincode: string; district: { name: string }; state: { name: string } }) {
  const dest = c.latitude !== null && c.longitude !== null ? `${c.latitude},${c.longitude}` : `${c.address}, ${c.district.name}, ${c.state.name} ${c.pincode}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

/**
 * One compact stat. Kept tiny so four cards fit comfortably across a desktop row.
 *
 * `tone="brand"` is for the one stat a visitor is actually shopping for — free seats — and it obeys
 * THE GREEN RULE: the icon is `text-green` (4.38:1, a graphic, over the 3:1 floor) and the number is
 * `text-green-dark` (6.61:1), because flat green never writes. A centre with no seats left falls
 * back to the default tone: green there would promise something that is not on offer.
 */
function Stat({ icon: Icon, label, value, tone = "default" }: { icon: typeof Users; label: string; value: number; tone?: "default" | "brand" }) {
  const brand = tone === "brand";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className={brand ? "h-4 w-4 text-green" : "h-4 w-4 text-navy-light"} aria-hidden />
      <span className={brand ? "font-heading text-base leading-none font-extrabold text-green-dark tabular-nums" : "font-heading text-base leading-none font-extrabold text-navy tabular-nums"}>
        {/* A newly opened centre genuinely has no trainers or students yet. A bare "0" reads as a
            broken statistic to a visitor, so an em dash says "nothing here yet" without overstating. */}
        {value > 0 ? value : <span aria-label="none yet">—</span>}
      </span>
      <span className="text-caption font-semibold tracking-wide text-muted uppercase">{label}</span>
    </div>
  );
}

/**
 * A training centre in the public list.
 *
 * Sized for a four-across desktop grid, so everything earns its place: the banner carries the
 * identity (initials, code, verification) and nothing else, and the name, address and code each
 * appear exactly once. It keeps `p-4` rather than the family's `card-p` because four of these share
 * a desktop row — and because the loading skeleton on the listing page mirrors this padding.
 */
export function CenterCard({ center, applyHref }: { center: CenterCardData; applyHref: string }) {
  const url = centerUrl(center);
  const courses = center.courses.map((c) => c.course);
  const shown = courses.slice(0, 3);
  const extra = courses.length - shown.length;
  const mark = initials(center.name.replace(/^eduskill\s+/i, "")) || "TC";

  return (
    <article className="group card card-hover relative flex h-full flex-col overflow-hidden">
      {/* Identity banner. A cover uploaded in Admin → Centres → Cover image shows through here,
          dimmed hard so the code and the Verified badge stay legible over any photograph. With no
          cover it falls back to the drawn gradient, which is also what the seeded placeholder art
          deserves — that art is only the centre name and code rendered into a gradient, so at this
          size it would ghost behind the chips and repeat the heading. */}
      <div className="relative h-24 overflow-hidden bg-navy">
        {center.coverImage && !isGeneratedCover(center.coverImage) && (
          <>
            <SafeImage src={center.coverImage} alt="" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw" />
            <span aria-hidden className="absolute inset-0 bg-navy/65" />
          </>
        )}
        {/* Two stops, not three: the old `via-navy` repeated the start colour. The lightest stop is
            the brand blue itself (white on it 8.49:1), so the code and the mark stay AAA wherever
            the diagonal puts them. */}
        <span aria-hidden className={cn("absolute inset-0 bg-linear-to-br from-navy to-navy-dark", center.coverImage && !isGeneratedCover(center.coverImage) && "opacity-0")} />
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "14px 14px" }}
        />
        {/* Soft brand glow, purely decorative: radial gradients, no blur pass. */}
        <span aria-hidden className="absolute -right-10 -bottom-14 h-36 w-36 rounded-full bg-[radial-gradient(closest-side,rgb(232_82_10/0.28),transparent)]" />
        <span aria-hidden className="absolute -top-12 -left-8 h-32 w-32 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.12),transparent)]" />

        <div className="relative flex h-full items-center gap-3 px-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/12 font-heading text-sm font-extrabold text-white ring-1 ring-white/25">
            {mark}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-mono text-caption font-semibold tracking-wider text-white/85">{center.code}</span>
            {center.isVerified && (
              /* Verification is the trust signal on this card, so it is the one that goes brand
                 green. Filled with green-on-navy and written in navy: 4.51:1, the same measured
                 pair the token was cut for, read the other way round. A white-on-navy chip said
                 exactly as much as the code beside it. */
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-on-navy px-2 py-0.5 text-caption font-bold tracking-wide text-navy uppercase">
                <BadgeCheck className="h-3 w-3" aria-hidden /> Verified
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-h4 text-navy">
          {/* At 17px the title is not "large text", so the old orange hover (3.72:1) failed AA here.
              `ring-focus` as well, because a navy → navy-light shift is not a focus indicator. */}
          <Link
            href={url}
            className="ring-focus transition-colors duration-micro ease-soft after:absolute after:inset-0 hover:text-navy-light focus-visible:text-navy-light motion-reduce:transition-none"
          >
            {center.name}
          </Link>
        </h3>

        <p className="mt-1.5 flex items-start gap-1.5 text-body-sm text-muted">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-navy-light" aria-hidden />
          <span className="min-w-0">
            <span className="block font-medium text-ink">
              {center.block.name}, {center.district.name}
            </span>
            <span className="block truncate text-caption">
              {center.state.name} · {center.pincode}
            </span>
          </span>
        </p>

        {shown.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1" aria-label="Courses offered">
            {shown.map((c) => (
              /* Same pale blue as the course card's category badge (`Badge tone="navy"`), so a
                 course name looks the same wherever the family shows one. Navy on it is 6.68:1. */
              <li key={c.id} className="inline-flex rounded-full bg-navy-soft px-2 py-0.5 text-caption font-semibold text-navy">
                {c.name}
              </li>
            ))}
            {extra > 0 && <li className="inline-flex rounded-full bg-surface px-2 py-0.5 text-caption font-bold text-muted">+{extra}</li>}
          </ul>
        )}

        <dl className="mt-auto grid grid-cols-3 gap-1 border-t border-line pt-4">
          <Stat icon={GraduationCap} label="Trainers" value={center.trainerCount} />
          <Stat icon={Users} label="Students" value={center.studentCount} />
          <Stat icon={Armchair} label="Seats" value={center.availableSeats} tone={center.availableSeats > 0 ? "brand" : "default"} />
        </dl>

        {/* Raised above the title's stretched link so both remain clickable. */}
        <div className="relative z-raised mt-4 grid grid-cols-2 gap-2">
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
            <Navigation className="h-4 w-4 text-navy-light" aria-hidden /> Directions
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
              /* Brand green, not `success` green: verified means "this is one of ours", not
                 "an operation succeeded". green-dark is 6.61:1 on white — flat green never writes. */
              <span className="inline-flex items-center gap-0.5 font-semibold text-green-dark">
                <BadgeCheck className="size-3.5" aria-hidden /> Verified
              </span>
            )}
          </p>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-body-sm text-muted">
        <MapPin className="mt-0.5 size-4 shrink-0 text-navy-light" aria-hidden />
        <span className="line-clamp-2">{center.location}</span>
      </p>
      {shown.length > 0 && (
        <ul className="mt-auto flex flex-wrap gap-1 pt-3" aria-label="Courses offered">
          {shown.map((name) => (
            <li key={name} className="max-w-full truncate rounded-full bg-navy-soft px-2 py-0.5 text-caption font-semibold text-navy">
              {name}
            </li>
          ))}
          {extra > 0 && <li className="rounded-full bg-surface px-2 py-0.5 text-caption font-bold text-muted">+{extra}</li>}
        </ul>
      )}
    </article>
  );
}
