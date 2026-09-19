import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CalendarClock, FileText, History, Mail, MapPin, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { calcAge, formatBytes, formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { CENTRE_STEPS, getCentreApplicationDetail } from "@/server/centre-applications";
import { activeCourses } from "@/server/courses";
import { PageHeader, Avatar, KeyValue, Timeline } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { CentreStatusBadge } from "@/components/admin/centre-applications/status";
import { StepProgress } from "@/components/admin/centre-applications/step-progress";
import { CentreDocumentActions } from "@/components/admin/centre-applications/document-actions";
import { CentreApplicationActions } from "@/components/admin/centre-applications/application-actions";

export const metadata: Metadata = { title: "Centre Application · Foundation Admin" };

const BASE = "/admin/centre-applications";

const FACILITY_LABELS = [
  ["hasElectricity", "Electricity"],
  ["hasDrinkingWater", "Drinking water"],
  ["hasToilet", "Toilet"],
  ["hasFurniture", "Furniture"],
] as const;

export default async function CentreApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("centre_applications.view");
  const { id } = await params;
  const app = await getCentreApplicationDetail(id).catch(() => null);
  if (!app) notFound();

  const can = {
    update: hasPermission(user, "centre_applications.update"),
    verify: hasPermission(user, "centre_applications.verify"),
    approve: hasPermission(user, "centre_applications.approve"),
    reject: hasPermission(user, "centre_applications.reject"),
  };

  const staffIds = [...new Set([app.reviewedById, app.verifiedById].filter((v): v is string => !!v))];
  const [staff, courses] = await Promise.all([
    staffIds.length ? db.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    can.approve ? activeCourses() : Promise.resolve([]),
  ]);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));

  const location = [app.villageTown, app.block.name, app.district.name, app.state.name].filter(Boolean).join(", ");
  const age = calcAge(app.dob);
  const history = [...app.statusHistory].reverse();
  const verifiedDocs = app.documents.filter((d) => d.status === "VERIFIED").length;
  const pendingDocs = app.documents.filter((d) => d.status === "PENDING").length;
  const facilities = FACILITY_LABELS.filter(([key]) => app[key]).map(([, label]) => label);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Centre Applications", href: BASE }, { label: app.applicationNo }]}
        mobileTitle={app.applicationNo}
        backHref={BASE}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={app.applicantName} src={app.photoUrl} size={56} />
            <span>
              {app.applicantName}
              <span className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-muted">
                <span className="font-mono text-navy">{app.applicationNo}</span>
                <CentreStatusBadge status={app.status} />
                {app.step > 0 && <Badge tone="orange">Step {app.step} of 7</Badge>}
              </span>
            </span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {/* The h1 is screen-reader only on phones, so the status travels with the description. */}
            <span className="inline-flex items-center gap-2 lg:hidden">
              <CentreStatusBadge status={app.status} />
              {app.step > 0 && <Badge tone="orange">Step {app.step} of 7</Badge>}
            </span>
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
        <div className="space-y-5 max-lg:order-1 lg:col-span-2">
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
          {app.center && (
            <Alert tone="success" title={`Centre started · ${app.center.code}`}>
              {app.center.name} was created from this application.{" "}
              <Link href={`/admin/centers/${app.center.id}`} className="font-semibold underline underline-offset-2">
                Open training centre
              </Link>
            </Alert>
          )}

          <Card>
            <CardHeader title="Shiksha Mission process" description={app.message} />
            <CardBody>
              {/* APPROVED ticks every step; REJECTED marks the step it stopped at in red. */}
              <StepProgress
                steps={CENTRE_STEPS}
                current={app.status === "APPROVED" ? CENTRE_STEPS.length + 1 : app.status === "REJECTED" ? 2 : app.step}
                rejected={app.status === "REJECTED"}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Applicant" description="The person who would run the centre." />
            <CardBody className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
              <KeyValue label="Full name" value={app.applicantName} />
              <KeyValue label="Date of birth" value={app.dob ? `${formatDate(app.dob)}${age !== null ? ` (${age} yrs)` : ""}` : "—"} />
              <KeyValue label="Gender" value={titleCase(app.gender) || "—"} />
              <KeyValue label="Mobile" value={app.mobile} />
              <KeyValue label="WhatsApp" value={app.whatsapp ?? "—"} />
              <KeyValue label="Email" value={app.email} />
              <KeyValue label="Highest qualification" value={app.qualification} />
              <KeyValue label="Occupation" value={app.occupation ?? "—"} />
              <KeyValue label="Teaching experience" value={`${app.teachingExperienceYears} year${app.teachingExperienceYears === 1 ? "" : "s"}`} />
              <KeyValue
                label="Photo"
                value={
                  app.photoUrl ? (
                    <a href={app.photoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-orange hover:underline md:min-h-0">
                      View photo
                    </a>
                  ) : (
                    "Not uploaded"
                  )
                }
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Where the centre would run" />
            <CardBody className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
              <KeyValue label="State" value={app.state.name} />
              <KeyValue label="District" value={app.district.name} />
              <KeyValue label="Block" value={app.block.name} />
              <KeyValue label="Village / town" value={app.villageTown} />
              <KeyValue label="PIN code" value={app.pincode} />
              <KeyValue label="Full address" value={app.address} className="sm:col-span-2 md:col-span-3" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Proposed centre" description="Space, classrooms and facilities declared by the applicant." />
            <CardBody className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
              <KeyValue label="Centre name" value={app.proposedName} className="sm:col-span-2" />
              <KeyValue label="Space type" value={titleCase(app.spaceType)} />
              <KeyValue label="Rooms" value={`${app.roomCount} room${app.roomCount === 1 ? "" : "s"}`} />
              <KeyValue label="Area" value={app.areaSqft ? `${app.areaSqft} sq ft` : "—"} />
              <KeyValue label="Seating capacity" value={`${app.seatingCapacity} children`} />
              <KeyValue label="Expected students" value={`${app.expectedStudents} children`} />
              <KeyValue
                label="Classes"
                value={
                  app.classes.length ? (
                    <span className="flex flex-wrap gap-1">
                      {app.classes.map((c) => (
                        <Badge key={c} tone="navy">
                          {titleCase(c)}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )
                }
                className="sm:col-span-2"
              />
              <KeyValue
                label="Facilities"
                value={
                  <span className="flex flex-wrap gap-1">
                    {FACILITY_LABELS.map(([key, label]) => (
                      <Badge key={key} tone={app[key] ? "success" : "neutral"}>
                        {app[key] ? label : `No ${label.toLowerCase()}`}
                      </Badge>
                    ))}
                  </span>
                }
                className="sm:col-span-2 md:col-span-3"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Motivation" description="Why the applicant wants to open a Class 1–4 centre." />
            <CardBody>
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink">{app.motivation}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Documents"
              description={
                app.documents.length
                  ? `${verifiedDocs} verified · ${pendingDocs} pending · ${app.documents.length - verifiedDocs - pendingDocs} rejected`
                  : "Identity, address and qualification proofs uploaded by the applicant."
              }
            />
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
                        {titleCase(d.type)}
                      </TD>
                      <TD label="File">
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs font-semibold text-orange hover:underline md:max-w-56">
                          {d.name}
                        </a>
                        <span className="text-xs text-muted">
                          {d.mimeType ?? ""}
                          {d.size ? ` · ${formatBytes(d.size)}` : ""}
                        </span>
                      </TD>
                      <TD label="Status">
                        <StatusBadge status={d.status} />
                        {d.verifiedAt && <span className="block text-xs text-muted">{formatDate(d.verifiedAt)}</span>}
                      </TD>
                      <TD label="Remarks" className="text-xs text-muted md:max-w-64">
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
                          {app.status !== "APPROVED" && <CentreDocumentActions applicationId={app.id} docId={d.id} name={titleCase(d.type)} status={d.status} canVerify={can.verify} />}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            )}
          </Card>

          <Card>
            <CardHeader title="Timeline" description="Every step of the process with the staff member who recorded it, newest first." />
            <CardBody>
              {history.length === 0 ? (
                <EmptyState icon={<History className="h-7 w-7" />} title="No activity yet" className="py-8" />
              ) : (
                <Timeline
                  items={history.map((h) => {
                    const actor = h.changedById ? (app.actors[h.changedById] ?? "Foundation staff") : "Applicant";
                    return {
                      title: h.fromStatus ? `${titleCase(h.fromStatus)} → ${titleCase(h.toStatus)}` : `Application ${titleCase(h.toStatus).toLowerCase()}`,
                      description: h.note ? <span className="whitespace-pre-line">{h.note}</span> : undefined,
                      meta: `${actor} · ${formatDateTime(h.createdAt)}`,
                      tone:
                        h.toStatus === "REJECTED"
                          ? ("danger" as const)
                          : h.toStatus === "APPROVED" || h.toStatus === "DOCUMENTS_VERIFIED" || h.toStatus === "SELECTED"
                            ? ("success" as const)
                            : h.toStatus === "DOCUMENTS_REQUIRED"
                              ? ("orange" as const)
                              : ("navy" as const),
                    };
                  })}
                />
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5 max-lg:order-2">
          <CentreApplicationActions
            id={app.id}
            applicationNo={app.applicationNo}
            status={app.status}
            allowedTransitions={app.allowedTransitions}
            verificationAt={app.verificationAt ? app.verificationAt.toISOString() : null}
            orientationAt={app.orientationAt ? app.orientationAt.toISOString() : null}
            orientationMode={app.orientationMode}
            agreementReference={app.agreementReference}
            approveDefaults={{ centerName: app.proposedName, capacity: app.seatingCapacity, phone: app.mobile }}
            courses={courses.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
            can={can}
          />

          <Card>
            <CardHeader title="Verification, agreement & orientation" />
            <CardBody className="space-y-4">
              <KeyValue
                label="Centre verification visit"
                value={
                  app.verificationAt ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4 text-orange" /> {formatDateTime(app.verificationAt)}
                    </span>
                  ) : (
                    "Not scheduled"
                  )
                }
              />
              <KeyValue label="Verification notes" value={app.verificationNotes ? <span className="whitespace-pre-line">{app.verificationNotes}</span> : "—"} />
              <KeyValue label="Documents verified by" value={app.verifiedById ? (staffName.get(app.verifiedById) ?? "Foundation staff") : "—"} />
              <KeyValue label="Agreement reference" value={app.agreementReference ?? "—"} />
              <KeyValue label="Agreement signed" value={app.agreementSignedAt ? formatDateTime(app.agreementSignedAt) : "—"} />
              <KeyValue
                label="Orientation"
                value={
                  app.orientationAt ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4 text-orange" /> {formatDateTime(app.orientationAt)}
                      {app.orientationMode ? ` · ${app.orientationMode}` : ""}
                    </span>
                  ) : (
                    "Not scheduled"
                  )
                }
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Review summary" />
            <CardBody className="space-y-4">
              <KeyValue label="Current status" value={<CentreStatusBadge status={app.status} />} />
              <KeyValue label="Current step" value={app.step > 0 ? `${app.step} of 7 · ${CENTRE_STEPS[app.step - 1]?.title ?? ""}` : "Rejected"} />
              <KeyValue label="Last reviewed by" value={app.reviewedById ? (staffName.get(app.reviewedById) ?? "Foundation staff") : "—"} />
              <KeyValue label="Review notes" value={app.reviewNotes ? <span className="whitespace-pre-line">{app.reviewNotes}</span> : "—"} />
              <KeyValue label="Documents" value={`${app.documents.length} uploaded · ${verifiedDocs} verified`} />
              <KeyValue label="Facilities declared" value={facilities.length ? facilities.join(", ") : "None declared"} />
              <KeyValue label="Last updated" value={formatDateTime(app.updatedAt)} />
            </CardBody>
          </Card>

          {app.center && (
            <Card>
              <CardHeader title="Training centre" />
              <CardBody className="space-y-4">
                <KeyValue label="Centre code" value={<span className="font-mono font-semibold text-navy">{app.center.code}</span>} />
                <KeyValue label="Name" value={app.center.name} />
                <KeyValue label="Status" value={<StatusBadge status={app.center.status} />} />
                <Link
                  href={`/admin/centers/${app.center.id}`}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white tap-highlight-none hover:bg-navy-dark lg:h-11"
                >
                  <Building2 className="h-4 w-4" aria-hidden /> Open training centre
                </Link>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
