"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, CalendarClock, FileText, Hash, Phone, RefreshCw, Search } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, type AlertTone } from "@/components/ui/feedback";
import { Badge, type BadgeTone, StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FormGrid, FormSection } from "@/components/ui/form";
import { KeyValue, Timeline, type TimelineItem } from "@/components/ui/misc";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { CentreSteps, type CentreStepItem } from "@/components/site/centre-steps";
import { CENTRE_DOCUMENT_TYPES, CENTRE_MAX_SPACE_PHOTOS } from "../centre-documents";

interface Option {
  value: string;
  label: string;
}

export interface CentreStatusFormProps {
  initialNo: string;
  /** `CENTRE_STEPS` from the centre-application service. */
  steps: readonly CentreStepItem[];
  /** `CENTRE_CLASSES`, for turning stored values into labels. */
  classes: readonly Option[];
}

interface Lookup {
  id: string;
  applicationNo: string;
  applicantName: string;
  proposedName: string;
  status: string;
  step: number;
  message: string;
  submittedAt: string;
  location: string;
  classes: string[];
  verificationAt: string | null;
  orientationAt: string | null;
  orientationMode: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  center: { id: string; code: string; name: string; slug: string; status: string } | null;
  documents: { id: string; type: string; name: string; status: string; remarks: string | null; createdAt: string }[];
  statusHistory: { toStatus: string; note: string | null; createdAt: string }[];
  canUpload: boolean;
  uploadToken: string | null;
}

const STATUS_TONE: Record<string, { badge: BadgeTone; alert: AlertTone }> = {
  SUBMITTED: { badge: "info", alert: "info" },
  UNDER_REVIEW: { badge: "info", alert: "info" },
  DOCUMENTS_REQUIRED: { badge: "warning", alert: "warning" },
  DOCUMENTS_VERIFIED: { badge: "success", alert: "success" },
  CENTRE_VERIFICATION: { badge: "info", alert: "info" },
  SELECTED: { badge: "success", alert: "success" },
  AGREEMENT_PENDING: { badge: "warning", alert: "info" },
  AGREEMENT_SIGNED: { badge: "success", alert: "success" },
  ORIENTATION: { badge: "info", alert: "info" },
  APPROVED: { badge: "success", alert: "success" },
  REJECTED: { badge: "danger", alert: "danger" },
};

const HISTORY_TONE: Record<string, TimelineItem["tone"]> = {
  SUBMITTED: "navy",
  UNDER_REVIEW: "navy",
  DOCUMENTS_REQUIRED: "orange",
  DOCUMENTS_VERIFIED: "success",
  CENTRE_VERIFICATION: "navy",
  SELECTED: "success",
  AGREEMENT_PENDING: "orange",
  AGREEMENT_SIGNED: "success",
  ORIENTATION: "navy",
  APPROVED: "success",
  REJECTED: "danger",
};

const SPACE_PHOTO = CENTRE_DOCUMENT_TYPES.find((d) => d.multiple);
const SINGLE_DOCS = CENTRE_DOCUMENT_TYPES.filter((d) => !d.multiple);

export function CentreStatusForm({ initialNo, steps, classes }: CentreStatusFormProps) {
  const [applicationNo, setApplicationNo] = React.useState(initialNo);
  const [mobile, setMobile] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<Lookup | null>(null);
  const [photo, setPhoto] = React.useState<UploadedFile | null>(null);
  const [uploads, setUploads] = React.useState<Record<string, UploadedFile | null>>({});
  const [spacePhotos, setSpacePhotos] = React.useState<(UploadedFile | null)[]>([null]);

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      const data = await api.post<Lookup>("/api/public/centre-applications/lookup", { applicationNo: applicationNo.trim(), mobile: mobile.trim() });
      setResult(data);
      setPhoto(null);
      setUploads({});
      setSpacePhotos([null]);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFieldErrors(err.fieldErrors);
        setError(err.status === 404 ? "We could not find an application with that number and mobile number. Please check both and try again." : err.message);
      } else {
        setError("Unable to look up your application right now. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const setSpacePhoto = (index: number, file: UploadedFile | null) => {
    const next = spacePhotos.map((p, i) => (i === index ? file : p));
    if (file && index === spacePhotos.length - 1 && spacePhotos.length < CENTRE_MAX_SPACE_PHOTOS) next.push(null);
    setSpacePhotos(next);
  };

  const tone = result ? (STATUS_TONE[result.status] ?? { badge: "neutral" as BadgeTone, alert: "info" as AlertTone }) : null;
  const uploadToken = result?.canUpload ? result.uploadToken : null;
  const classLabels = result ? classes.filter((c) => result.classes.includes(c.value)).map((c) => c.label) : [];
  const docTypeName = (key: string) => CENTRE_DOCUMENT_TYPES.find((d) => d.key === key)?.name ?? titleCase(key);
  const anyUpload = !!photo || Object.values(uploads).some(Boolean) || spacePhotos.some(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardBody className="p-5 sm:p-8">
          <form onSubmit={lookup} noValidate>
            <FormGrid>
              <Field label="Application number" required error={fieldErrors.applicationNo}>
                <Input
                  value={applicationNo}
                  onChange={(e) => setApplicationNo(e.target.value.toUpperCase())}
                  leftIcon={<Hash className="h-4 w-4" />}
                  placeholder="CEN-2026-000123"
                  invalid={!!fieldErrors.applicationNo}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              </Field>
              <Field label="Registered mobile number" required error={fieldErrors.mobile}>
                <Input
                  inputMode="numeric"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  leftIcon={<Phone className="h-4 w-4" />}
                  placeholder="10-digit mobile"
                  invalid={!!fieldErrors.mobile}
                  autoComplete="tel"
                />
              </Field>
            </FormGrid>
            {error && (
              <Alert tone="danger" className="mt-4">
                {error}
              </Alert>
            )}
            <div className="mt-5">
              <Button type="submit" loading={loading} size="lg" leftIcon={<Search className="h-4 w-4" />} fullWidth className="sm:w-auto">
                Check status
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {result && tone && (
        <>
          <Card>
            <CardHeader
              title={result.applicationNo}
              description={`${result.applicantName} · ${result.proposedName}`}
              action={<Badge tone={tone.badge} dot>{titleCase(result.status)}</Badge>}
            />
            <CardBody className="space-y-5">
              <Alert tone={tone.alert} title={result.status === "REJECTED" ? "Not approved" : `Step ${result.step} of 7 · ${steps[Math.max(result.step - 1, 0)]?.title ?? ""}`}>
                {result.message}
              </Alert>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KeyValue label="Submitted" value={formatDate(result.submittedAt)} />
                <KeyValue label="Location" value={result.location} />
                <KeyValue label="Classes" value={classLabels.length ? classLabels.join(", ") : "—"} />
                <KeyValue label="Documents" value={`${result.documents.length} uploaded`} />
              </div>

              {result.verificationAt && (
                <div className="flex gap-3 rounded-card border border-info/30 bg-info-light p-4 text-body text-blue-900">
                  <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  <div>
                    <p className="font-semibold">Centre verification visit</p>
                    <p>{formatDateTime(result.verificationAt)}</p>
                    <p className="mt-1 text-body-sm opacity-80">Please be at the proposed space with your original documents. The team checks the rooms, the classroom and the basic facilities.</p>
                  </div>
                </div>
              )}

              {result.orientationAt && (
                <div className="flex gap-3 rounded-card border border-orange/25 bg-orange-light/60 p-4 text-body text-navy">
                  <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-orange" aria-hidden />
                  <div>
                    <p className="font-semibold">Orientation</p>
                    <p>
                      {formatDateTime(result.orientationAt)}
                      {result.orientationMode ? ` · ${result.orientationMode}` : ""}
                    </p>
                    <p className="mt-1 text-body-sm opacity-80">The orientation covers how to run the centre and the academics for Class 1 to 4.</p>
                  </div>
                </div>
              )}

              {result.status === "DOCUMENTS_REQUIRED" && result.reviewNotes && (
                <Alert tone="warning" title="What the review team needs">
                  <p className="whitespace-pre-wrap">{result.reviewNotes}</p>
                </Alert>
              )}

              {result.status === "REJECTED" && result.rejectionReason && (
                <Alert tone="danger" title="Reason">
                  <p className="whitespace-pre-wrap">{result.rejectionReason}</p>
                </Alert>
              )}

              {result.center && (
                <div className="rounded-card border border-success/30 bg-success-light card-p">
                  <p className="flex items-center gap-2 text-overline text-success-dark">
                    <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
                    Your centre code
                  </p>
                  <p className="mt-1 font-heading text-h2 tracking-wide text-navy">{result.center.code}</p>
                  <p className="mt-2 text-body text-ink">
                    {result.center.name} is authorised and can begin Class 1 to 4 classes. The Foundation team will be in touch about academics and student admissions.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="The seven steps" description="Where your application stands in the centre-opening process." />
            <CardBody>
              <CentreSteps steps={steps} current={result.step} size="sm" />
              {result.status === "REJECTED" && <p className="mt-4 text-sm text-muted">This application is closed, so no step is in progress.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Progress" description="Every update on your application." />
            <CardBody>
              <Timeline
                items={result.statusHistory.map((h) => ({
                  title: titleCase(h.toStatus),
                  description: h.note ?? undefined,
                  meta: formatDateTime(h.createdAt),
                  tone: HISTORY_TONE[h.toStatus] ?? "navy",
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Documents" description="Status of everything you have uploaded so far." />
            <CardBody className="space-y-6">
              {result.documents.length === 0 ? (
                <p className="text-body text-muted">No documents uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-line rounded-card border border-line">
                  {result.documents.map((d) => (
                    <li key={d.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-lavender text-navy">
                          <FileText className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="text-body font-semibold text-ink">{docTypeName(d.type)}</p>
                          <p className="truncate text-xs text-muted">
                            {d.name} · {formatDate(d.createdAt)}
                          </p>
                          {d.remarks && <p className="mt-0.5 text-xs text-danger">{d.remarks}</p>}
                        </div>
                      </div>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              )}

              {uploadToken && (
                <div className="space-y-6 border-t border-line pt-5">
                  <div>
                    <p className="text-sm font-bold text-navy">{result.status === "DOCUMENTS_REQUIRED" ? "Upload the requested documents" : "Add or replace documents"}</p>
                    <p className="text-xs text-muted">
                      Files are stored privately. Uploading while your application is &ldquo;Documents required&rdquo; moves it straight back to review.
                    </p>
                  </div>

                  <FormSection title="Your photograph" description="A recent, clear passport-style photo (JPG or PNG, up to 2 MB).">
                    <FileUpload
                      endpoint={`/api/public/centre-applications/${result.id}/photo`}
                      fields={{ token: uploadToken }}
                      accept=".jpg,.jpeg,.png"
                      maxSizeMb={2}
                      value={photo}
                      onChange={setPhoto}
                      label="Upload photo"
                      capture="user"
                      preview={false}
                    />
                  </FormSection>

                  <FormSection title="Identity and address documents" description="JPG, PNG or PDF up to 5 MB each.">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      {SINGLE_DOCS.map((d) => (
                        <div key={d.key} className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink">{d.name}</p>
                            <Badge tone={d.required ? "orange" : "neutral"}>{d.required ? "Required" : "Optional"}</Badge>
                          </div>
                          <p className="text-xs text-muted">{d.description}</p>
                          <FileUpload
                            endpoint={`/api/public/centre-applications/${result.id}/documents`}
                            fields={{ token: uploadToken, type: d.key }}
                            accept={d.accept}
                            maxSizeMb={d.maxMb}
                            value={uploads[d.key] ?? null}
                            onChange={(f) => setUploads((u) => ({ ...u, [d.key]: f }))}
                            label={`Upload ${d.name.toLowerCase()}`}
                            preview={false}
                          />
                        </div>
                      ))}
                    </div>
                  </FormSection>

                  {SPACE_PHOTO && (
                    <FormSection title={SPACE_PHOTO.name} description={`${SPACE_PHOTO.description} Up to ${CENTRE_MAX_SPACE_PHOTOS} photos, ${SPACE_PHOTO.maxMb} MB each.`}>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {spacePhotos.map((p, i) => (
                          <FileUpload
                            key={i}
                            endpoint={`/api/public/centre-applications/${result.id}/documents`}
                            fields={{ token: uploadToken, type: SPACE_PHOTO.key }}
                            accept={SPACE_PHOTO.accept}
                            maxSizeMb={SPACE_PHOTO.maxMb}
                            value={p}
                            onChange={(f) => setSpacePhoto(i, f)}
                            label={`Upload photo ${i + 1}`}
                          />
                        ))}
                      </div>
                    </FormSection>
                  )}

                  {anyUpload && (
                    <Button variant="outline" onClick={() => void lookup()} loading={loading} leftIcon={<RefreshCw className="h-4 w-4" />} fullWidth className="sm:w-auto">
                      Refresh my status
                    </Button>
                  )}
                </div>
              )}

              {!result.canUpload && result.status !== "REJECTED" && (
                <p className="text-sm text-muted">Your application is complete, so new uploads are closed. Contact the Foundation if a document needs to be changed.</p>
              )}
            </CardBody>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/open-a-centre" variant="outline" fullWidth className="sm:w-auto">
              About the programme
            </ButtonLink>
            <ButtonLink href="/contact" variant="ghost" fullWidth className="sm:w-auto">
              Contact the Foundation
            </ButtonLink>
          </div>
        </>
      )}

      {!result && (
        <p className="text-center text-sm text-muted">
          Lost your application number? It was sent to your email and mobile when you applied. If you cannot find it,{" "}
          <Link href="/contact" className="font-semibold text-orange hover:underline">
            contact the Foundation
          </Link>
          .
        </p>
      )}
    </div>
  );
}
