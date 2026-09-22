import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarDays, ChevronRight, FolderOpen, IdCard, Mail, MapPin, Phone, Settings, UsersRound } from "lucide-react";
import { requireTrainer } from "@/lib/auth/guards";
import { formatDate, titleCase } from "@/lib/utils";
import { trainerDocumentAttention, trainerLocationLabel, trainerProfile } from "@/server/trainer-scope";
import { PageHeader, Avatar, KeyValue } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { ProfileEditSheet, ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My Profile" };

const ROW = "flex min-h-14 items-center gap-3 px-4 py-2.5 text-left tap-highlight-none transition-colors duration-micro active:bg-surface motion-reduce:transition-none";

function HubRow({ href, icon, label, hint, badge }: { href: string; icon: React.ReactNode; label: string; hint?: string; badge?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className={ROW}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ink">{label}</span>
          {hint && <span className="block truncate text-caption text-muted">{hint}</span>}
        </span>
        {badge}
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

export default async function TrainerProfilePage() {
  const user = await requireTrainer();
  const [p, docs] = await Promise.all([trainerProfile(user.trainer.id), trainerDocumentAttention(user.trainer.id)]);
  const docsHint = docs.total ? [docs.missing && `${docs.missing} required missing`, docs.rejected && `${docs.rejected} to upload again`].filter(Boolean).join(" · ") : "Resume and certificates on file";
  const docsBadge = docs.total ? <Badge tone="orange" className="shrink-0">{docs.total}</Badge> : null;
  const location = trainerLocationLabel(p);
  const initial = { bio: p.bio ?? "", qualification: p.qualification ?? "", skills: p.skills, languages: p.languages, avatarUrl: p.user.avatarUrl };

  return (
    <>
      <PageHeader title="My Profile" description="Your volunteer trainer record. Contact details are managed by the Foundation." />
      <InactiveBanner status={p.status} />

      {/* ───────────── Phone ───────────── */}
      <div className="space-y-4 lg:hidden">
        <section className="flex flex-col items-center gap-1.5 py-2 text-center" aria-label="Your identity">
          <Avatar name={p.user.name} src={p.user.avatarUrl} size={88} className="ring-4 ring-lavender" />
          <h2 className="mt-1 font-heading text-h3 text-navy">{p.user.name}</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-soft px-2.5 py-1 font-mono text-caption font-semibold text-navy">
            <IdCard className="h-3.5 w-3.5" aria-hidden /> {p.trainerId}
          </span>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <Badge tone="navy">{titleCase(p.level)} level</Badge>
            <StatusBadge status={p.status} />
          </div>
          <div className="flex flex-col items-center text-body-sm text-muted">
            {p.user.mobile && (
              <a href={`tel:${p.user.mobile}`} className="inline-flex min-h-11 items-center gap-1.5 text-navy">
                <Phone className="h-4 w-4" aria-hidden /> {p.user.mobile}
              </a>
            )}
            {p.user.email && (
              <a href={`mailto:${p.user.email}`} className="inline-flex min-h-11 items-center gap-1.5 break-all text-navy">
                <Mail className="h-4 w-4 shrink-0" aria-hidden /> {p.user.email}
              </a>
            )}
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden /> {location}
              </span>
            )}
          </div>
        </section>

        <ProfileEditSheet initial={initial} disabled={p.status !== "ACTIVE"} />

        <section className="card card-p" aria-label="About me">
          <h3 className="text-overline text-muted">About me</h3>
          <div className="mt-3 space-y-3">
            <KeyValue label="Qualification" value={p.qualification || "Not added yet"} />
            <KeyValue label="Skills" value={p.skills.length ? p.skills.join(", ") : "Not added yet"} />
            <KeyValue label="Languages" value={p.languages.length ? p.languages.join(", ") : "Not added yet"} />
            <KeyValue label="Bio" value={p.bio ? <span className="whitespace-pre-line">{p.bio}</span> : "Not added yet"} />
          </div>
        </section>

        <section aria-label="Trainer record">
          <h3 className="mb-2 px-1 text-overline text-muted">Trainer record</h3>
          <div className="card card-p grid grid-cols-2 gap-3">
            <KeyValue label="Trainer since" value={formatDate(p.joinedAt)} />
            <KeyValue label="Level" value={`${titleCase(p.level)} level`} />
            {p.application && <KeyValue label="Application" value={p.application.applicationNo} />}
            {p.application && <KeyValue label="Experience" value={`${p.application.experienceYears} yrs work · ${p.application.teachingExperienceYears} yrs teaching`} className="col-span-2" />}
            {p.application?.availability && <KeyValue label="Availability" value={p.application.availability} className="col-span-2" />}
            {p.application && <KeyValue label="Preferred mode" value={titleCase(p.application.trainingMode)} />}
          </div>
        </section>

        <section aria-label="Shortcuts">
          <h3 className="mb-2 px-1 text-overline text-muted">More</h3>
          <ul className="card divide-y divide-line overflow-hidden">
            <HubRow href="/trainer/profile/documents" icon={<FolderOpen className="h-5 w-5" aria-hidden />} label="My documents" hint={docsHint} badge={docsBadge} />
            <HubRow href="/trainer/assignments" icon={<Building2 className="h-5 w-5" aria-hidden />} label="My assignments" hint="Centers, courses and batches" />
            <HubRow href="/trainer/batches" icon={<UsersRound className="h-5 w-5" aria-hidden />} label="My batches" hint="Everything you teach" />
            <HubRow href="/trainer/timetable" icon={<CalendarDays className="h-5 w-5" aria-hidden />} label="Timetable" hint="Your week at a glance" />
            <HubRow href="/trainer/settings" icon={<Settings className="h-5 w-5" aria-hidden />} label="Settings" hint="Password and devices" />
          </ul>
        </section>
      </div>

      {/* ───────────── Desktop ───────────── */}
      <div className="hidden grid-cols-1 gap-6 lg:grid lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody className="flex flex-col items-center text-center">
            <Avatar name={p.user.name} src={p.user.avatarUrl} size={112} />
            <h2 className="mt-4 text-h3 text-navy">{p.user.name}</h2>
            <p className="font-mono text-body-sm text-muted">{p.trainerId}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Badge tone="navy">{titleCase(p.level)} level</Badge>
              <StatusBadge status={p.status} />
            </div>
            <div className="mt-6 w-full space-y-3 text-left">
              <KeyValue label="Email" value={p.user.email ?? "—"} />
              <KeyValue label="Mobile" value={p.user.mobile ?? "—"} />
              <KeyValue label="Assigned location" value={location || "—"} />
              <KeyValue label="Trainer since" value={formatDate(p.joinedAt)} />
              {p.application && <KeyValue label="Application" value={`${p.application.applicationNo} · ${formatDate(p.application.submittedAt)}`} />}
              {p.application && <KeyValue label="Experience" value={`${p.application.experienceYears} yrs work · ${p.application.teachingExperienceYears} yrs teaching`} />}
              {p.application?.availability && <KeyValue label="Availability" value={p.application.availability} />}
              {p.application && <KeyValue label="Preferred mode" value={titleCase(p.application.trainingMode)} />}
            </div>
            <div className="mt-6 w-full rounded-lg border border-line bg-surface/60 p-4 text-left">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-lavender text-navy" aria-hidden>
                  <FolderOpen className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold text-ink">My documents</p>
                  <p className={docs.total ? "text-caption font-semibold text-orange" : "text-caption text-muted"}>{docsHint}</p>
                </div>
              </div>
              <ButtonLink href="/trainer/profile/documents" variant={docs.total ? "primary" : "outline"} size="sm" fullWidth className="mt-3">
                {docs.total ? "Review documents" : "View or update documents"}
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Edit profile" description="Update your bio, skills, languages, qualification and photo." />
          <CardBody>
            <ProfileForm initial={initial} disabled={p.status !== "ACTIVE"} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
