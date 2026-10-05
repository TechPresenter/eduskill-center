import type { LucideIcon } from "lucide-react";
import { Award, BookOpenCheck, CalendarClock, GraduationCap, HandCoins, MapPin, MonitorSmartphone, PlayCircle, Sparkles } from "lucide-react";

export interface CourseBenefit {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface BenefitSource {
  mode: "OFFLINE" | "ONLINE" | "HYBRID" | string;
  durationText: string;
  totalClasses: number;
  certificateEligibility: string | null;
  minAttendancePct: number;
  passingMarksPct: number;
  scholarshipAvailable: boolean;
  scholarshipNote: string | null;
  centerCount: number;
  materialCount: number;
  freePreviewCount: number;
  isFree: boolean;
}

/**
 * Benefits are DERIVED, never authored twice: each card restates one column the Foundation has
 * already filled in (mode, class count, certificate rule, scholarship flag, centre coverage, the
 * material and free-preview rows). A field that is not configured produces no card, and with no
 * cards at all the page simply omits the section — so there is never a "Benefits" heading with
 * nothing under it, and never a number that is not counted from the database.
 */
export function courseBenefits(s: BenefitSource): CourseBenefit[] {
  const out: CourseBenefit[] = [];

  if (s.isFree) {
    out.push({ icon: HandCoins, title: "No course fee", description: "Nothing is charged for this course at EduSkill training centers." });
  }

  if (s.totalClasses > 0) {
    out.push({
      icon: CalendarClock,
      title: `${s.totalClasses} classes`,
      description: s.durationText ? `Structured over ${s.durationText}, with attendance tracked for every class.` : "Attendance is tracked for every class.",
    });
  }

  if (s.mode === "ONLINE") {
    out.push({ icon: MonitorSmartphone, title: "Learn online", description: "Join from home on a phone or a computer — no travel to a centre." });
  } else if (s.mode === "HYBRID") {
    out.push({ icon: MonitorSmartphone, title: "Classroom and online", description: "Practical sessions at your centre, theory you can follow from home." });
  } else if (s.mode === "OFFLINE") {
    out.push({ icon: GraduationCap, title: "Classroom training", description: "Taught in person, with a trainer beside you for every practical." });
  }

  if (s.freePreviewCount > 0) {
    out.push({
      icon: PlayCircle,
      title: s.freePreviewCount === 1 ? "1 preview lesson" : `${s.freePreviewCount} preview lessons`,
      description: "Open them from the course content above and see how the teaching works before you enrol.",
    });
  }

  if (s.materialCount > 0) {
    out.push({
      icon: BookOpenCheck,
      title: s.materialCount === 1 ? "1 study resource" : `${s.materialCount} study resources`,
      description: "Notes and practice files you keep access to for the whole course.",
    });
  }

  out.push({
    icon: Award,
    title: "Certificate you can verify",
    description:
      s.certificateEligibility?.trim() ||
      `Complete the course with at least ${s.minAttendancePct}% attendance and ${s.passingMarksPct}% in assessments to earn a certificate with a unique number anyone can verify online.`,
  });

  if (s.scholarshipAvailable) {
    out.push({
      icon: Sparkles,
      title: "Scholarship support",
      description: s.scholarshipNote?.trim() || "Need-based and merit scholarships can reduce the payable fee. The final amount is decided during application review.",
    });
  }

  if (s.centerCount > 0) {
    out.push({
      icon: MapPin,
      title: s.centerCount === 1 ? "Offered at 1 training center" : `Offered at ${s.centerCount} training centers`,
      description: "Choose the centre nearest to you when you apply.",
    });
  }

  return out;
}

/** Benefits — three columns of what a student actually gets. Renders nothing when the list is empty. */
export function CourseBenefits({ benefits }: { benefits: CourseBenefit[] }) {
  if (benefits.length === 0) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {benefits.map((b) => (
        <li key={b.title} className="card card-hover flex h-full flex-col gap-3 card-p">
          <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-md bg-orange-light text-orange">
            <b.icon className="h-5 w-5" />
          </span>
          <h3 className="text-h4 text-navy">{b.title}</h3>
          <p className="text-body-sm text-muted">{b.description}</p>
        </li>
      ))}
    </ul>
  );
}
