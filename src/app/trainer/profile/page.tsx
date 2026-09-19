import type { Metadata } from "next";
import { requireTrainer } from "@/lib/auth/guards";
import { formatDate, titleCase } from "@/lib/utils";
import { trainerLocationLabel, trainerProfile } from "@/server/trainer-scope";
import { PageHeader, Avatar, KeyValue } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My Profile" };

export default async function TrainerProfilePage() {
  const user = await requireTrainer();
  const p = await trainerProfile(user.trainer.id);
  const location = trainerLocationLabel(p);

  return (
    <>
      <PageHeader title="My Profile" description="Your volunteer trainer record. Contact details are managed by the Foundation." />
      <InactiveBanner status={p.status} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody className="flex flex-col items-center text-center">
            <Avatar name={p.user.name} src={p.user.avatarUrl} size={112} />
            <h2 className="mt-4 text-lg font-bold text-navy">{p.user.name}</h2>
            <p className="text-sm text-muted">{p.trainerId}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Badge tone="navy">{titleCase(p.level)} level</Badge>
              <StatusBadge status={p.status} />
            </div>
            <dl className="mt-6 w-full space-y-3 text-left">
              <KeyValue label="Email" value={p.user.email ?? "—"} />
              <KeyValue label="Mobile" value={p.user.mobile ?? "—"} />
              <KeyValue label="Assigned location" value={location || "—"} />
              <KeyValue label="Trainer since" value={formatDate(p.joinedAt)} />
              {p.application && <KeyValue label="Application" value={`${p.application.applicationNo} · ${formatDate(p.application.submittedAt)}`} />}
              {p.application && <KeyValue label="Experience" value={`${p.application.experienceYears} yrs work · ${p.application.teachingExperienceYears} yrs teaching`} />}
              {p.application?.availability && <KeyValue label="Availability" value={p.application.availability} />}
              {p.application && <KeyValue label="Preferred mode" value={titleCase(p.application.trainingMode)} />}
            </dl>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Edit profile" description="Update your bio, skills, languages, qualification and photo." />
          <CardBody>
            <ProfileForm
              trainerId={p.id}
              disabled={p.status !== "ACTIVE"}
              initial={{ bio: p.bio ?? "", qualification: p.qualification ?? "", skills: p.skills, languages: p.languages, avatarUrl: p.user.avatarUrl }}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
