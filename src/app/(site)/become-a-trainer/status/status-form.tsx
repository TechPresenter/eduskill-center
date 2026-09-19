"use client";

import * as React from "react";
import { CalendarClock, FileText, Hash, LogIn, Phone, Search } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormGrid } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { KeyValue, Timeline, type TimelineItem } from "@/components/ui/misc";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";

interface DocType {
  key: string;
  name: string;
  description: string | null;
  isRequired: boolean;
}

interface Lookup {
  id: string;
  applicationNo: string;
  name: string;
  level: string;
  status: string;
  submittedAt: string;
  location: string;
  interviewAt: string | null;
  interviewMode: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  trainerId: string | null;
  documents: { id: string; type: string; name: string; status: string; remarks: string | null; createdAt: string }[];
  statusHistory: { toStatus: string; note: string | null; createdAt: string }[];
  canUpload: boolean;
  uploadToken: string | null;
}

const MESSAGES: Record<string, { title: string; body: string; tone: "info" | "success" | "warning" | "danger" }> = {
  SUBMITTED: { title: "Application received", body: "Thank you for volunteering. Our trainer team will start reviewing your application shortly.", tone: "info" },
  UNDER_REVIEW: { title: "Under review", body: "Your profile, skills and documents are being reviewed by the Foundation's trainer team.", tone: "info" },
  DOCUMENTS_REQUIRED: { title: "Documents required", body: "We need a few more documents before we can continue. Please read the note below and upload the requested files.", tone: "warning" },
  SHORTLISTED: { title: "Shortlisted", body: "Congratulations — you have been shortlisted. We will contact you to schedule an interview or complete verification.", tone: "success" },
  INTERVIEW: { title: "Interview scheduled", body: "Your interview has been scheduled. Please keep the details below handy and join on time.", tone: "info" },
  VERIFIED: { title: "Verified", body: "Your documents and interview have been verified. Final approval is in progress.", tone: "success" },
  APPROVED: { title: "Approved — welcome aboard!", body: "You are now an EduSkill volunteer trainer. Use the login details sent to your email/mobile to access the Trainer Portal.", tone: "success" },
  REJECTED: { title: "Not selected this time", body: "We are unable to take your application forward. Thank you for your interest in volunteering with us.", tone: "danger" },
};

const HISTORY_TONE: Record<string, TimelineItem["tone"]> = {
  SUBMITTED: "navy",
  UNDER_REVIEW: "navy",
  DOCUMENTS_REQUIRED: "orange",
  SHORTLISTED: "success",
  INTERVIEW: "navy",
  VERIFIED: "success",
  APPROVED: "success",
  REJECTED: "danger",
};

export function TrainerStatusForm({ initialNo, documentTypes }: { initialNo: string; documentTypes: DocType[] }) {
  const [applicationNo, setApplicationNo] = React.useState(initialNo);
  const [mobile, setMobile] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<Lookup | null>(null);
  const [uploads, setUploads] = React.useState<Record<string, UploadedFile | null>>({});

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      const data = await api.post<Lookup>("/api/public/trainer-applications/lookup", { applicationNo: applicationNo.trim(), mobile: mobile.trim() });
      setResult(data);
      setUploads({});
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFieldErrors(err.fieldErrors);
        setError(err.status === 404 ? "We could not find an application with that number and mobile. Please check both and try again." : err.message);
      } else setError("Unable to look up your application right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const msg = result ? (MESSAGES[result.status] ?? { title: titleCase(result.status), body: "", tone: "info" as const }) : null;
  const uploadToken = result?.canUpload ? result.uploadToken : null;
  const docTypeName = (key: string) => documentTypes.find((d) => d.key === key)?.name ?? titleCase(key);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardBody className="p-6 sm:p-8">
          <form onSubmit={lookup} noValidate>
            <FormGrid>
              <Field label="Application number" htmlFor="applicationNo" required error={fieldErrors.applicationNo}>
                <Input id="applicationNo" value={applicationNo} onChange={(e) => setApplicationNo(e.target.value.toUpperCase())} leftIcon={<Hash className="h-4 w-4" />} placeholder="TAP-2026-000123" invalid={!!fieldErrors.applicationNo} autoComplete="off" />
              </Field>
              <Field label="Registered mobile number" htmlFor="mobile" required error={fieldErrors.mobile}>
                <Input id="mobile" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} leftIcon={<Phone className="h-4 w-4" />} placeholder="10-digit mobile" invalid={!!fieldErrors.mobile} autoComplete="tel" />
              </Field>
            </FormGrid>
            {error && (
              <Alert tone="danger" className="mt-4">
                {error}
              </Alert>
            )}
            <div className="mt-5 flex justify-end">
              <Button type="submit" loading={loading} leftIcon={<Search className="h-4 w-4" />}>
                Check status
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {result && msg && (
        <>
          <Card>
            <CardHeader title={result.applicationNo} description={`${result.name} · ${titleCase(result.level)} level · ${result.location}`} action={<StatusBadge status={result.status} />} />
            <CardBody className="space-y-5">
              <Alert tone={msg.tone} title={msg.title}>
                {msg.body}
              </Alert>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KeyValue label="Submitted" value={formatDate(result.submittedAt)} />
                <KeyValue label="Level" value={`${titleCase(result.level)} level`} />
                <KeyValue label="Location" value={result.location} />
                <KeyValue label="Documents" value={`${result.documents.length} uploaded`} />
              </div>

              {result.status === "INTERVIEW" && result.interviewAt && (
                <div className="flex gap-3 rounded-xl border border-info/30 bg-info-light p-4 text-sm text-blue-900">
                  <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Interview details</p>
                    <p>
                      {formatDateTime(result.interviewAt)}
                      {result.interviewMode ? ` · ${result.interviewMode}` : ""}
                    </p>
                    <p className="mt-1 text-xs opacity-80">Please keep your original documents ready. If you cannot attend, reply to the interview email or call the Foundation office.</p>
                  </div>
                </div>
              )}

              {result.status === "DOCUMENTS_REQUIRED" && result.reviewNotes && (
                <Alert tone="warning" title="Note from the review team">
                  <p className="whitespace-pre-wrap">{result.reviewNotes}</p>
                </Alert>
              )}
              {result.status === "REJECTED" && result.rejectionReason && (
                <Alert tone="danger" title="Reason">
                  <p className="whitespace-pre-wrap">{result.rejectionReason}</p>
                </Alert>
              )}

              {result.status === "APPROVED" && (
                <div className="rounded-2xl border border-success/30 bg-success-light p-5">
                  <p className="text-xs font-semibold tracking-[0.2em] text-green-800 uppercase">Your Trainer ID</p>
                  <p className="mt-1 font-heading text-2xl font-extrabold text-navy sm:text-3xl">{result.trainerId ?? "Being issued"}</p>
                  <p className="mt-2 text-sm text-green-900">Log in with the email or mobile number on your application. If you have not received a password, use &ldquo;Forgot password&rdquo; on the login page.</p>
                  <div className="mt-4">
                    <ButtonLink href="/login" variant="navy" leftIcon={<LogIn className="h-4 w-4" />}>
                      Log in to Trainer Portal
                    </ButtonLink>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Progress" description="Every status change on your application." />
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
            <CardHeader title="Documents" description="Status of each document you have uploaded." />
            <CardBody className="space-y-5">
              {result.documents.length === 0 ? (
                <p className="text-sm text-muted">No documents uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {result.documents.map((d) => (
                    <li key={d.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lavender text-navy">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{docTypeName(d.type)}</p>
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
                <div className="space-y-4 border-t border-line pt-5">
                  <div>
                    <p className="text-sm font-bold text-navy">{result.status === "DOCUMENTS_REQUIRED" ? "Upload the requested documents" : "Add or replace documents"}</p>
                    <p className="text-xs text-muted">PDF or image files up to 5 MB. Uploading while &ldquo;Documents required&rdquo; automatically moves your application back to review.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {documentTypes.map((d) => (
                      <div key={d.key} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-ink">{d.name}</p>
                          <Badge tone={d.isRequired ? "orange" : "neutral"}>{d.isRequired ? "Required" : "Optional"}</Badge>
                        </div>
                        <FileUpload
                          endpoint={`/api/public/trainer-applications/${result.id}/documents`}
                          fields={{ token: uploadToken, type: d.key }}
                          accept={d.key === "resume" ? ".pdf,.doc,.docx" : ".jpg,.jpeg,.png,.pdf"}
                          maxSizeMb={5}
                          value={uploads[d.key] ?? null}
                          onChange={(f) => setUploads((u) => ({ ...u, [d.key]: f }))}
                          label={`Upload ${d.name.toLowerCase()}`}
                          preview={false}
                        />
                      </div>
                    ))}
                  </div>
                  {Object.values(uploads).some(Boolean) && (
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => void lookup()} loading={loading}>
                        Refresh status
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
