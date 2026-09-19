import { IdCard, MapPin } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";

export interface StudentIdCardProps {
  name: string;
  studentId?: string | null;
  photoUrl?: string | null;
  course?: string | null;
  center?: string | null;
  batch?: string | null;
  /** Shown under the name when there is no admission yet. */
  location?: string | null;
  applyHref?: string;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-[4.5rem] shrink-0 text-[11px] font-semibold tracking-wide text-white/55 uppercase">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{value}</dd>
    </div>
  );
}

/**
 * Navy "student ID card" that opens the phone home screen: photo, name, Student ID chip and the
 * current course / center / batch. Without an admission it invites the student to apply instead.
 */
export function StudentIdCard({ name, studentId, photoUrl, course, center, batch, location, applyHref = "/student/apply" }: StudentIdCardProps) {
  return (
    <section className="overflow-hidden rounded-2xl bg-navy text-white shadow-card" aria-label="Student card">
      <div className="flex items-center gap-3 p-4">
        <Avatar name={name} src={photoUrl} size={56} className="ring-2 ring-white/25" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-[0.18em] text-white/55 uppercase">Student</p>
          <h2 className="truncate font-heading text-[17px] font-extrabold text-white">{name}</h2>
          {studentId ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-orange-light/15 px-2 py-0.5 font-mono text-[12px] font-semibold text-orange-light">
              <IdCard className="h-3.5 w-3.5" aria-hidden />
              {studentId}
            </span>
          ) : (
            <p className="mt-0.5 text-[12px] text-white/60">ID issued on admission</p>
          )}
        </div>
      </div>

      {course || center || batch ? (
        <dl className="space-y-2 border-t border-white/10 px-4 py-3.5">
          {course && <Row label="Course" value={course} />}
          {center && <Row label="Center" value={center} />}
          {batch && <Row label="Batch" value={batch} />}
        </dl>
      ) : (
        <div className="border-t border-white/10 px-4 py-3.5">
          <p className="text-[13px] text-white/75">No active admission yet.</p>
          {location && (
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-white/55">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /> {location}
            </p>
          )}
          <ButtonLink href={applyHref} variant="white" fullWidth className="mt-3">
            Find a center & apply
          </ButtonLink>
        </div>
      )}
    </section>
  );
}
