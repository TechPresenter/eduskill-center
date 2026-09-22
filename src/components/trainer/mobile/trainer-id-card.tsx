import { Building2, IdCard, MapPin } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";

export interface TrainerIdCardProps {
  name: string;
  trainerId: string;
  photoUrl?: string | null;
  /** "Senior level volunteer" etc. */
  level?: string | null;
  /** ACTIVE / INACTIVE / SUSPENDED — anything but ACTIVE shows a quiet warning strip. */
  status: string;
  /** Block, district, state of the trainer's mandate. */
  location?: string | null;
  /** First assigned centre, shown as the day-to-day posting. */
  center?: string | null;
  /** How many centres in total, so "+2 more" is honest rather than hidden. */
  centerCount?: number;
  profileHref?: string;
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-[4.5rem] shrink-0 text-caption font-semibold tracking-wide text-white/55 uppercase">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-body-sm font-semibold text-white">
        {icon}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}

/**
 * Navy trainer card that opens the phone home — the trainer's answer to the student ID card:
 * photo, name, Trainer ID chip, level, and the posting (centre + mandate location).
 *
 * No `card-hover`/transform here: the card sits at the top of a scrolling page and a transform on an
 * ancestor would become the containing block for any fixed child rendered inside it.
 */
export function TrainerIdCard({ name, trainerId, photoUrl, level, status, location, center, centerCount = 0, profileHref = "/trainer/profile" }: TrainerIdCardProps) {
  const extra = centerCount > 1 ? ` +${centerCount - 1} more` : "";
  return (
    <section className="overflow-hidden rounded-2xl bg-navy text-white shadow-e1" aria-label="Trainer card">
      <div className="flex items-center gap-3 p-4">
        <Avatar name={name} src={photoUrl} size={56} className="ring-2 ring-white/25" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-bold tracking-[0.18em] text-white/55 uppercase">Volunteer Trainer</p>
          <h2 className="truncate font-heading text-h4 text-white">{name}</h2>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-orange-light/15 px-2 py-0.5 font-mono text-caption font-semibold text-orange-light">
            <IdCard className="h-3.5 w-3.5" aria-hidden />
            {trainerId}
          </span>
        </div>
      </div>

      <dl className="space-y-2 border-t border-white/10 px-4 py-3.5">
        {level && <Row label="Level" value={level} />}
        <Row label="Center" value={center ? `${center}${extra}` : "Not assigned yet"} icon={<Building2 className="h-3.5 w-3.5 shrink-0 text-white/60" aria-hidden />} />
        {location && <Row label="Area" value={location} icon={<MapPin className="h-3.5 w-3.5 shrink-0 text-white/60" aria-hidden />} />}
      </dl>

      {status !== "ACTIVE" && (
        <p className="border-t border-white/10 bg-warning/15 px-4 py-2.5 text-body-sm font-semibold text-warning-light">
          Your account is {status.toLowerCase()} — you can view records but not mark attendance or post.
        </p>
      )}

      <div className="px-4 pb-4">
        <ButtonLink href={profileHref} variant="white" size="sm" fullWidth>
          View my profile
        </ButtonLink>
      </div>
    </section>
  );
}
