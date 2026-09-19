import Link from "next/link";
import { Bell, BookOpen, ChevronRight, FolderOpen, GraduationCap, IdCard, KeyRound, LifeBuoy, LogOut, MapPin, Phone, UserPen, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/misc";
import { Alert } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/stats";
import { LogoutButton } from "@/components/portal/shell";

/** Required student fields, mirrored from the profile form so the hub can show a completion bar server-side. */
const REQUIRED_FIELDS = ["name", "guardianName", "guardianRelation", "dob", "gender", "mobile", "stateId", "districtId", "blockId", "villageTown", "address", "pincode", "qualification"] as const;

export type ProfileCompletionInput = Partial<Record<(typeof REQUIRED_FIELDS)[number], unknown>>;

/** Percentage of required profile fields that are filled in (0-100). */
export function profileCompletionPct(student: ProfileCompletionInput): number {
  const filled = REQUIRED_FIELDS.filter((k) => String(student[k] ?? "").trim().length > 0).length;
  return Math.round((filled / REQUIRED_FIELDS.length) * 100);
}

const ROW = "flex min-h-14 items-center gap-3 px-4 py-2.5 text-left tap-highlight-none transition-colors active:bg-surface";

function RowIcon({ children, tone = "navy" }: { children: React.ReactNode; tone?: "navy" | "danger" }) {
  return <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone === "danger" ? "bg-danger-light text-danger" : "bg-lavender text-navy")}>{children}</span>;
}

function HubRow({ href, icon, label, hint, badge }: { href: string; icon: React.ReactNode; label: string; hint?: string; badge?: number }) {
  return (
    <li>
      <Link href={href} className={ROW}>
        <RowIcon>{icon}</RowIcon>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{label}</span>
          {hint && <span className="block truncate text-[12px] text-muted">{hint}</span>}
        </span>
        {badge ? <span className="shrink-0 rounded-full bg-orange px-2 py-0.5 text-[12px] font-bold text-white tabular-nums">{badge}</span> : null}
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

export interface ProfileHubProps {
  name: string;
  studentId?: string | null;
  photoUrl?: string | null;
  mobile?: string | null;
  email?: string | null;
  location?: string | null;
  qualification?: string | null;
  completion: number;
  profileCompleted: boolean;
  /** Documents that still need attention (pending verification / rejected). */
  documentsPending?: number;
  unreadNotifications?: number;
  /** Shown straight after registration (`/student/profile?welcome=1`). */
  welcome?: boolean;
  className?: string;
}

/**
 * Phone profile screen: identity header, completion bar, one row per profile section and an
 * account list ending in Log out. Every row is at least 56px tall.
 */
export function ProfileHub({ name, studentId, photoUrl, mobile, email, location, qualification, completion, profileCompleted, documentsPending = 0, unreadNotifications = 0, welcome, className }: ProfileHubProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {welcome && !profileCompleted && (
        <Alert tone="success" title="Welcome! One more step">
          Fill in your details so you can apply for a course.{" "}
          <Link href="/student/profile/edit?welcome=1" className="font-semibold underline">
            Complete profile
          </Link>
        </Alert>
      )}

      <section className="flex flex-col items-center gap-1.5 py-2 text-center" aria-label="Your identity">
        <Avatar name={name} src={photoUrl} size={88} className="ring-4 ring-lavender" />
        <h2 className="mt-1 font-heading text-xl font-extrabold text-navy">{name}</h2>
        {studentId ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-soft px-2.5 py-1 font-mono text-[12px] font-semibold text-navy">
            <IdCard className="h-3.5 w-3.5" aria-hidden /> {studentId}
          </span>
        ) : (
          <span className="text-[12px] text-muted">Student ID is issued on admission</span>
        )}
        <div className="flex flex-col items-center text-[13px] text-muted">
          {mobile && (
            <a href={`tel:${mobile}`} className="inline-flex min-h-11 items-center gap-1.5 text-navy">
              <Phone className="h-4 w-4" aria-hidden /> {mobile}
            </a>
          )}
          {location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden /> {location}
            </span>
          )}
        </div>
      </section>

      {!profileCompleted && (
        <div className="card p-4">
          <ProgressBar label={`Profile ${completion}% complete`} value={completion} tone={completion >= 80 ? "success" : "orange"} />
          <p className="mt-2 text-[13px] text-muted">A complete profile is required before you can apply for a course.</p>
          <Link
            href="/student/profile/edit"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-orange px-4 text-[15px] font-semibold text-white tap-highlight-none transition-transform active:scale-[0.98] motion-reduce:transition-none"
          >
            Complete profile
          </Link>
        </div>
      )}

      <div>
        <h3 className="mb-2 px-1 text-[12px] font-bold tracking-[0.14em] text-muted uppercase">My details</h3>
        <ul className="card divide-y divide-line overflow-hidden">
          <HubRow href="/student/profile/edit#personal" icon={<UserCircle className="h-5 w-5" aria-hidden />} label="Personal details" hint="Name, guardian, date of birth" />
          <HubRow href="/student/profile/edit#contact" icon={<Phone className="h-5 w-5" aria-hidden />} label="Contact" hint={[mobile, email].filter(Boolean).join(" · ") || "Mobile, WhatsApp, email"} />
          <HubRow href="/student/profile/edit#address" icon={<MapPin className="h-5 w-5" aria-hidden />} label="Address" hint={location ?? "State, district, block"} />
          <HubRow href="/student/profile/edit#education" icon={<GraduationCap className="h-5 w-5" aria-hidden />} label="Education" hint={qualification ?? "Qualification, institution"} />
          <HubRow href="/student/documents" icon={<FolderOpen className="h-5 w-5" aria-hidden />} label="Documents" hint={documentsPending ? "Action needed" : "Uploaded documents"} badge={documentsPending || undefined} />
        </ul>
      </div>

      <div>
        <h3 className="mb-2 px-1 text-[12px] font-bold tracking-[0.14em] text-muted uppercase">Account</h3>
        <ul className="card divide-y divide-line overflow-hidden">
          <HubRow href="/student/profile/edit" icon={<UserPen className="h-5 w-5" aria-hidden />} label="Edit profile" />
          <HubRow href="/student/settings" icon={<KeyRound className="h-5 w-5" aria-hidden />} label="Change password" hint="And manage logged-in devices" />
          <HubRow href="/student/notifications" icon={<Bell className="h-5 w-5" aria-hidden />} label="Notifications" badge={unreadNotifications || undefined} />
          <HubRow href="/student/support" icon={<LifeBuoy className="h-5 w-5" aria-hidden />} label="Help &amp; support" hint="FAQs, call, WhatsApp, enquiry" />
          <HubRow href="/student/materials" icon={<BookOpen className="h-5 w-5" aria-hidden />} label="Study material" />
          <li>
            <LogoutButton className={cn(ROW, "w-full text-danger")}>
              <RowIcon tone="danger">
                <LogOut className="h-5 w-5" aria-hidden />
              </RowIcon>
              <span className="min-w-0 flex-1 text-[15px] font-semibold">Log out</span>
            </LogoutButton>
          </li>
        </ul>
      </div>
    </div>
  );
}
