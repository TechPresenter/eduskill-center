import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, FileText, History, Mail, MapPin, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { calcAge, formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { getTrainerApplicationDetail } from "@/server/trainers";
import { PageHeader, Avatar, KeyValue, Timeline } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ApplicationActions } from "@/components/admin/trainers/application-actions";
import { DocumentActions } from "@/components/admin/trainers/document-actions";
import { NoteForm } from "@/components/admin/trainers/note-form";

export const metadata = { title: "Trainer Application" };

export default async function TrainerApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("trainers.view");
  const { id } = await params;
  const app = await getTrainerApplicationDetail(id).catch(() => null);
  if (!app) notFound();

  const can = { update: hasPermission(user, "trainers.update"), reject: hasPermission(user, "trainers.reject"), approve: hasPermission(user, "trainers.approve") };
  const [docTypes, reviewer] = await Promise.all([
    db.documentType.findMany({ where: { appliesTo: "TRAINER" }, select: { key: true, name: true } }),
    app.reviewedById ? db.user.findUnique({ where: { id: app.reviewedById }, select: { name: true } }) : Promise.resolve(null),
  ]);
  const docName = new Map(docTypes.map((d) => [d.key, d.name]));
  const location = [app.block?.name, app.district?.name, app.state.name].filter(Boolean).join(", ");
  const age = calcAge(app.dob);
  const history = [...app.statusHistory].reverse();
  const verifiedDocs = app.documents.filter((d) => d.status === "VERIFIED").length;
  const pendingDocs = app.documents.filter((d) => d.status === "PENDING").length;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Trainer Applications", href: "/admin/trainer-applications" }, { label: app.applicationNo }]}
        mobileTitle={app.applicationNo}
        backHref="/admin/trainer-applications"
        title={
          <span className="flex items-center gap-4">
            <Avatar name={app.name} src={app.photoUrl} size={56} />
            <span>
              {app.name}
              <span className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-muted">
                <span className="font-mono text-navy">{app.applicationNo}</span>
                <StatusBadge status={app.status} />
                <Badge tone="navy">{titleCase(app.level)} level</Badge>
              </span>
            </span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> {app.mobile}
            </span>
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> {app.email}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {location}
            </span>
            <span>Submitted {formatDateTime(app.submittedAt)}</span>
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 max-lg:order-2 lg:col-span-2">
          {app.status === "DOCUMENTS_REQUIRED" && app.reviewNotes && (
            <Alert tone="warning" title="Waiting for documents from the applicant">
              {app.reviewNotes}
            </Alert>
          )}
          {app.status === "REJECTED" && app.rejectionReason && (
            <Alert tone="danger" title="Application rejected">
              {app.rejectionReason}
            </Alert>
          )}
          {app.trainer && (
            <Alert tone="success" title={`Approved · Trainer ID ${app.trainer.trainerId}`}>
              A trainer account exists for {app.trainer.user.name}.{" "}
              <Link href={`/admin/trainers/${app.trainer.id}`} className="font-semibold underline underline-offset-2">
                Open trainer profile
              </Link>
            </Alert>
          )}

          <Card>
            <CardHeader title="Personal details" />
            <CardBody className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
              <KeyValue label="Full name" value={app.name} />
              <KeyValue label="Date of birth" value={`${formatDate(app.dob)}${age !== null ? ` (${age} yrs)` : ""}`} />
              <KeyValue label="Gender" value={titleCase(app.gender)} />
              <KeyValue label="Mobile" value={app.mobile} />
              <KeyValue label="WhatsApp" value={app.whatsapp ?? "—"} />
              <KeyValue label="Email" value={app.email} />
              <KeyValue label="Address" value={app.address} className="sm:col-span-2" />
              <KeyValue label="PIN code" value={app.pincode} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Volunteer level & location" description="Where the applicant wants to volunteer. Location must match the chosen level." />
            <CardBody className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-4">
              <KeyValue label="Level" value={<Badge tone="navy">{titleCase(app.level)}</Badge>} />
              <KeyValue label="State" value={app.state.name} />
              <KeyValue label="District" value={app.district?.name ?? (app.level === "STATE" ? "Any (state level)" : "—")} />
              <KeyValue label="Block" value={app.block?.name ?? (app.level !== "BLOCK" ? `Any (${titleCase(app.level).toLowerCase()} level)` : "—")} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Professional background" />
            <CardBody className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
              <KeyValue label="Highest qualification" value={app.qualification} />
              <KeyValue label="Work experience" value={`${app.experienceYears} year${app.experienceYears === 1 ? "" : "s"}`} />
              <KeyValue label="Teaching experience" value={`${app.teachingExperienceYears} year${app.teachingExperienceYears === 1 ? "" : "s"}`} />
              <KeyValue label="Preferred training mode" value={titleCase(app.trainingMode)} />
              <KeyValue label="Availability" value={app.availability ?? "—"} className="sm:col-span-2" />
              <KeyValue
                label="Skills"
                value={
                  <span className="flex flex-wrap gap-1">
                    {app.skills.map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </span>
                }
                className="sm:col-span-2 md:col-span-3"
              />
              <KeyValue
                label="Languages"
                value={
                  <span className="flex flex-wrap gap-1">
                    {app.languages.map((s) => (
                      <Badge key={s} tone="info">
                        {s}
                      </Badge>
                    ))}
                  </span>
                }
                className="sm:col-span-2 md:col-span-3"
              />
              <KeyValue
                label="Preferred courses"
                value={
                  app.preferredCourses.length ? (
                    <span className="flex flex-wrap gap-1">
                      {app.preferredCourses.map((c) => (
                        <Link key={c.id} href={`/admin/courses/${c.id}`} className="inline-flex items-center rounded-full border border-navy/10 bg-navy-soft px-2.5 py-0.5 text-xs font-semibold text-navy hover:bg-lavender">
                          {c.name} <span className="ml-1 font-normal text-muted">({c.code})</span>
                        </Link>
                      ))}
                    </span>
                  ) : (
                    "No preference"
                  )
                }
                className="sm:col-span-2 md:col-span-3"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Motivation" description="Why the applicant wants to volunteer with the Foundation." />
            <CardBody>
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink">{app.motivation}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Documents" description={app.documents.length ? `${verifiedDocs} verified · ${pendingDocs} pending · ${app.documents.length - verifiedDocs - pendingDocs} rejected` : "Uploaded by the applicant during or after the application."} />
            {app.documents.length === 0 ? (
              <CardBody>
                <EmptyState icon={<FileText className="h-7 w-7" />} title="No documents uploaded" description="Use “Request Documents” to ask the applicant for specific files." className="py-8" />
              </CardBody>
            ) : (
              <TableWrap className="max-md:px-4 max-md:pb-4 md:rounded-none md:border-0">
                <THead>
                  <tr>
                    <TH>Document</TH>
                    <TH>File</TH>
                    <TH>Status</TH>
                    <TH>Remarks</TH>
                    <TH>Uploaded</TH>
                    <TH>Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {app.documents.map((d) => (
                    <TR key={d.id}>
                      <TD mobile="full" className="font-medium">
                        {docName.get(d.type) ?? titleCase(d.type)}
                      </TD>
                      <TD label="File">
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs font-semibold text-orange hover:underline md:max-w-[14rem]">
                          {d.name}
                        </a>
                        <span className="text-xs text-muted">
                          {d.mimeType ?? ""}
                          {d.size ? ` · ${(d.size / 1024).toFixed(0)} KB` : ""}
                        </span>
                      </TD>
                      <TD label="Status">
                        <StatusBadge status={d.status} />
                        {d.verifiedAt && <span className="block text-xs text-muted">{formatDate(d.verifiedAt)}</span>}
                      </TD>
                      <TD label="Remarks" className="text-xs text-muted md:max-w-[16rem]">
                        {d.remarks ?? "—"}
                      </TD>
                      <TD label="Uploaded" className="text-muted md:whitespace-nowrap">
                        {formatDate(d.createdAt)}
                      </TD>
                      <TD mobile="actions">
                        <div className="flex items-center gap-2 max-md:w-full max-md:justify-end">
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-navy hover:underline md:min-h-0 md:px-0">
                            View
                          </a>
                          {app.status !== "APPROVED" && <DocumentActions docId={d.id} status={d.status} canUpdate={can.update} />}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            )}
          </Card>

          <Card>
            <CardHeader title="Timeline & notes" description="Every status change and internal note, newest first." />
            <CardBody className="space-y-6">
              {can.update && app.status !== "APPROVED" && <NoteForm applicationId={app.id} />}
              {history.length === 0 ? (
                <EmptyState icon={<History className="h-7 w-7" />} title="No activity yet" className="py-8" />
              ) : (
                <Timeline
                  items={history.map((h) => {
                    const isNote = h.fromStatus === h.toStatus;
                    const actor = h.changedById ? (app.actors[h.changedById] ?? "Staff") : "Applicant";
                    return {
                      title: isNote ? "Internal note" : h.fromStatus ? `${titleCase(h.fromStatus)} → ${titleCase(h.toStatus)}` : `Application ${titleCase(h.toStatus).toLowerCase()}`,
                      description: h.note ? <span className="whitespace-pre-line">{h.note}</span> : undefined,
                      meta: `${actor} · ${formatDateTime(h.createdAt)}`,
                      tone: isNote ? "neutral" : h.toStatus === "REJECTED" ? "danger" : h.toStatus === "APPROVED" || h.toStatus === "VERIFIED" ? "success" : h.toStatus === "DOCUMENTS_REQUIRED" ? "orange" : "navy",
                    };
                  })}
                />
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5 max-lg:order-1">
          <Card>
            <CardHeader title="Actions" description={app.status === "VERIFIED" ? "All checks done – approve to issue a Trainer ID." : app.status === "APPROVED" ? "This application is complete." : "Move the application through the review workflow."} />
            <CardBody>
              <ApplicationActions id={app.id} status={app.status} allowedTransitions={app.allowedTransitions} interviewAt={app.interviewAt} interviewMode={app.interviewMode} can={can} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Interview" />
            <CardBody className="space-y-4">
              {app.interviewAt ? (
                <>
                  <KeyValue
                    label="Scheduled"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-4 w-4 text-orange" /> {formatDateTime(app.interviewAt)}
                      </span>
                    }
                  />
                  <KeyValue label="Mode" value={app.interviewMode ?? "—"} />
                  <KeyValue label="Interview notes" value={app.interviewNotes ? <span className="whitespace-pre-line">{app.interviewNotes}</span> : "—"} />
                </>
              ) : (
                <p className="text-sm text-muted">No interview scheduled yet. Shortlist the applicant, then use “Schedule Interview”.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Review summary" />
            <CardBody className="space-y-4">
              <KeyValue label="Current status" value={<StatusBadge status={app.status} />} />
              <KeyValue label="Last reviewed by" value={reviewer?.name ?? "—"} />
              <KeyValue label="Review notes" value={app.reviewNotes ? <span className="whitespace-pre-line">{app.reviewNotes}</span> : "—"} />
              <KeyValue label="Documents" value={`${app.documents.length} uploaded · ${verifiedDocs} verified`} />
              <KeyValue label="Last updated" value={formatDateTime(app.updatedAt)} />
            </CardBody>
          </Card>

          {app.trainer && (
            <Card>
              <CardHeader title="Trainer record" />
              <CardBody className="space-y-4">
                <KeyValue label="Trainer ID" value={<span className="font-mono font-semibold text-navy">{app.trainer.trainerId}</span>} />
                <KeyValue label="Status" value={<StatusBadge status={app.trainer.status} />} />
                <KeyValue label="Login" value={app.trainer.user.email ?? app.trainer.user.mobile ?? "—"} />
                <KeyValue label="Joined" value={formatDate(app.trainer.joinedAt)} />
                <Link href={`/admin/trainers/${app.trainer.id}`} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-navy px-4 text-sm font-semibold text-white tap-highlight-none hover:bg-navy-dark lg:h-11">
                  Open trainer profile
                </Link>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
