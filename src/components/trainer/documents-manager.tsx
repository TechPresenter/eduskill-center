"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronRight, Clock, ExternalLink, FileText, FileUser, History, Image as ImageIcon, RefreshCw, UploadCloud } from "lucide-react";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { ProgressBar } from "@/components/ui/stats";
import { EmptyState } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";

export interface TrainerDocType {
  key: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  /** `accept` string for the picker, e.g. ".pdf,.jpg" — built on the server from the same list the API enforces. */
  accept: string;
}

export interface TrainerDoc {
  id: string;
  type: string;
  name: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  status: string;
  remarks: string | null;
  verifiedAt: string | null;
  createdAt: string;
  /** Uploaded while applying (carried over on approval). */
  fromApplication: boolean;
}

export interface TrainerDocumentsManagerProps {
  types: TrainerDocType[];
  documents: TrainerDoc[];
  maxMb: number;
}

const ENDPOINT = "/api/trainer/documents";
const RESUME_KEY = "resume";

/** "PDF, DOC, JPG" from ".pdf,.doc,.jpg" — shown next to every uploader so the limits are never a surprise. */
function acceptLabel(accept: string) {
  return accept
    .split(",")
    .map((p) => p.trim().replace(/^\./, "").toUpperCase())
    .filter((p) => p && p !== "JPEG")
    .join(", ");
}

function statusLine(doc: TrainerDoc): { text: string; tone: string; Icon: React.ComponentType<{ className?: string }> } {
  if (doc.status === "VERIFIED") return { text: doc.verifiedAt ? `Verified on ${formatDate(doc.verifiedAt)}` : "Verified by the Foundation", tone: "text-success", Icon: CheckCircle2 };
  if (doc.status === "REJECTED") return { text: `Not accepted${doc.remarks ? `: ${doc.remarks}` : ""}. Please upload a clearer or correct copy.`, tone: "text-danger", Icon: AlertCircle };
  return { text: "Waiting for the Foundation to verify it", tone: "text-warning", Icon: Clock };
}

/** Tinted icon container used by every row on this screen. */
function IconTile({ tone = "lavender", size = "md", children }: { tone?: "lavender" | "orange" | "danger"; size?: "md" | "lg"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md",
        size === "lg" ? "h-12 w-12" : "h-10 w-10",
        tone === "orange" ? "bg-orange-light text-orange" : tone === "danger" ? "bg-danger-light text-danger" : "bg-lavender text-navy"
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

/** The file on record: tappable name (opens the private file), size · date, and where it came from. */
function FileLine({ doc, className }: { doc: TrainerDoc; className?: string }) {
  const isImage = !!doc.mimeType?.startsWith("image/");
  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-lg border border-line bg-white p-2.5 tap-highlight-none transition-colors duration-micro active:bg-surface hover:border-navy/30 motion-reduce:transition-none",
        className
      )}
    >
      <IconTile>{isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</IconTile>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-body-sm font-semibold text-navy">
          <span className="truncate">{doc.name}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </span>
        <span className="block text-caption text-muted tabular-nums">
          {doc.size ? `${formatBytes(doc.size)} · ` : ""}
          {formatDate(doc.createdAt)}
          {doc.fromApplication ? " · from your application" : ""}
        </span>
      </span>
      <span className="sr-only">Opens in a new tab</span>
    </a>
  );
}

function StatusNote({ doc }: { doc: TrainerDoc }) {
  const s = statusLine(doc);
  return (
    <p className={cn("flex items-start gap-1.5 text-body-sm font-medium", s.tone)}>
      <s.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{s.text}</span>
    </p>
  );
}

/**
 * "My documents": the trainer's own copy of what the Foundation holds on file. The resume leads as a
 * hero card (the user asked for it by name); every other type configured by the Foundation follows as
 * an app list whose rows open a sheet with the file, its verification, earlier uploads and the uploader.
 * Uploading never edits a file in place — each upload is a new PENDING record, so the screen always
 * tells the trainer that a replacement goes back for verification.
 */
export function TrainerDocumentsManager({ types, documents, maxMb }: TrainerDocumentsManagerProps) {
  const router = useRouter();
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  const byType = React.useMemo(() => {
    const m = new Map<string, TrainerDoc[]>();
    for (const d of documents) m.set(d.type, [...(m.get(d.type) ?? []), d]);
    return m;
  }, [documents]);

  if (types.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-7 w-7" />}
        title="No document types are set up yet"
        description="The Foundation has not configured any trainer documents. Anything you uploaded while applying is still on file with them."
      />
    );
  }

  const resume = types.find((t) => t.key === RESUME_KEY) ?? null;
  const others = types.filter((t) => t !== resume);
  const known = new Set(types.map((t) => t.key));
  const orphaned = documents.filter((d) => !known.has(d.type));

  const required = types.filter((t) => t.isRequired);
  const requiredOnFile = required.filter((t) => {
    const latest = byType.get(t.key)?.[0];
    return latest && latest.status !== "REJECTED";
  }).length;
  const latestAll = types.map((t) => byType.get(t.key)?.[0]).filter((d): d is TrainerDoc => !!d);
  const verified = latestAll.filter((d) => d.status === "VERIFIED").length;
  const pending = latestAll.filter((d) => d.status === "PENDING").length;
  const rejected = latestAll.filter((d) => d.status === "REJECTED").length;

  const onUploaded = (t: TrainerDocType, replaced: boolean) => {
    toast.success(replaced ? `New ${t.name.toLowerCase()} uploaded` : `${t.name} uploaded`, "The Foundation will verify it shortly.");
    setOpenKey(null);
    router.refresh();
  };

  const uploader = (t: TrainerDocType, latest: TrainerDoc | null, idSuffix = "") => (
    <FileUpload
      key={`${t.key}${idSuffix}`}
      endpoint={ENDPOINT}
      fields={{ type: t.key }}
      accept={t.accept}
      maxSizeMb={maxMb}
      value={null}
      sources={["camera", "gallery", "files"]}
      capture="environment"
      onChange={(f) => {
        if (f) onUploaded(t, !!latest);
      }}
      label={latest ? `Upload a new ${t.name.toLowerCase()}` : `Upload ${t.name.toLowerCase()}`}
      hint={`${acceptLabel(t.accept)} · up to ${maxMb} MB`}
    />
  );

  const open = openKey ? (types.find((t) => t.key === openKey) ?? null) : null;
  const openDocs = open ? (byType.get(open.key) ?? []) : [];
  const openLatest = openDocs[0] ?? null;

  const resumeDocs = resume ? (byType.get(resume.key) ?? []) : [];
  const resumeLatest = resumeDocs[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
      <div className="space-y-4 lg:col-span-2">
        {/* ── Summary ── */}
        <section className="card card-p animate-fade-up motion-reduce:animate-none" aria-labelledby="docs-summary">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="docs-summary" className="text-overline text-muted">
              Required documents
            </h2>
            <p className="font-heading text-h4 text-navy tabular-nums" role="status" aria-atomic="true">
              <span className="sr-only">Required documents on file: </span>
              {requiredOnFile}
              <span className="text-body-sm font-semibold text-muted"> / {required.length}</span>
            </p>
          </div>
          <ProgressBar value={requiredOnFile} max={Math.max(required.length, 1)} tone={required.length && requiredOnFile === required.length ? "success" : "orange"} className="mt-3" />
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Verified", value: verified, cls: "text-success" },
              { label: "Pending", value: pending, cls: "text-warning" },
              { label: "Rejected", value: rejected, cls: rejected ? "text-danger" : "text-muted" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-surface px-2 py-2.5">
                <dt className="text-caption text-muted">{s.label}</dt>
                <dd className={cn("font-heading text-h4 tabular-nums", s.cls)}>{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Resume hero ── */}
        {resume && (
          <section className="card overflow-hidden animate-fade-up motion-reduce:animate-none" aria-labelledby="doc-resume">
            <div className="flex items-start gap-3 p-4 sm:p-5">
              <IconTile tone={resumeLatest?.status === "REJECTED" ? "danger" : "orange"} size="lg">
                <FileUser className="h-6 w-6" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="doc-resume" className="font-heading text-h4 text-navy">
                    {resume.name}
                  </h2>
                  {resumeLatest ? <StatusBadge status={resumeLatest.status} /> : resume.isRequired ? <Badge tone="orange">Required</Badge> : <Badge>Optional</Badge>}
                </div>
                <p className="mt-0.5 text-body-sm text-muted">{resume.description || "Keep your CV current — the Foundation reads it when assigning centers and courses."}</p>
              </div>
            </div>
            <div className="space-y-3 border-t border-line bg-surface/50 p-4 sm:p-5">
              {resumeLatest && (
                <>
                  <FileLine doc={resumeLatest} />
                  <StatusNote doc={resumeLatest} />
                </>
              )}
              {!resumeLatest || resumeLatest.status === "REJECTED" ? (
                uploader(resume, resumeLatest, "-hero")
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button variant="primary" onClick={() => setOpenKey(resume.key)} leftIcon={<RefreshCw className="h-4 w-4" />} fullWidth>
                    Replace resume
                  </Button>
                  {resumeDocs.length > 1 ? (
                    <Button variant="outline" onClick={() => setOpenKey(resume.key)} leftIcon={<History className="h-4 w-4" />} fullWidth>
                      Earlier uploads ({resumeDocs.length - 1})
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* ── Every other document type ── */}
      <div className="space-y-4 lg:col-span-3">
        {others.length > 0 && (
          <section aria-labelledby="docs-others">
            <h2 id="docs-others" className="mb-2 px-1 text-overline text-muted">
              {resume ? "Other documents" : "Documents"}
            </h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {others.map((t) => {
                const docs = byType.get(t.key) ?? [];
                const latest = docs[0] ?? null;
                const attention = !latest ? t.isRequired : latest.status === "REJECTED";
                return (
                  <li key={t.key} className="animate-fade-in motion-reduce:animate-none">
                    <button
                      type="button"
                      onClick={() => setOpenKey(t.key)}
                      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left tap-highlight-none ring-focus transition-colors duration-micro active:bg-surface hover:bg-surface/60 motion-reduce:transition-none"
                      aria-haspopup="dialog"
                    >
                      <IconTile tone={attention ? (latest ? "danger" : "orange") : "lavender"}>{latest ? <FileText className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}</IconTile>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-semibold text-ink">{t.name}</span>
                        <span className={cn("block truncate text-caption", latest?.status === "REJECTED" ? "font-semibold text-danger" : "text-muted")}>
                          {latest ? (latest.status === "REJECTED" ? "Not accepted — upload again" : latest.name) : t.isRequired ? "Required · not uploaded yet" : "Optional · not uploaded yet"}
                          {docs.length > 1 ? ` · ${docs.length} files` : ""}
                        </span>
                      </span>
                      {latest ? <StatusBadge status={latest.status} className="shrink-0" /> : <Badge tone={t.isRequired ? "orange" : "neutral"} className="shrink-0">{t.isRequired ? "Upload" : "Add"}</Badge>}
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {orphaned.length > 0 && (
          <section aria-labelledby="docs-orphaned">
            <h2 id="docs-orphaned" className="mb-2 px-1 text-overline text-muted">
              No longer requested
            </h2>
            <ul className="card space-y-2 p-3">
              {orphaned.map((d) => (
                <li key={d.id} className="space-y-1.5">
                  <FileLine doc={d} />
                  <div className="flex justify-end">
                    <StatusBadge status={d.status} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="px-1 text-caption text-muted">
          Files are private: only you and the Foundation staff who verify trainers can open them. Every new upload goes back for verification, even when it replaces a verified document.
        </p>
      </div>

      <ResponsiveSheet
        open={!!open}
        onClose={() => setOpenKey(null)}
        title={open?.name ?? "Document"}
        description={open ? (open.description ?? (open.isRequired ? "Required by the Foundation" : "Optional")) : undefined}
        size="md"
      >
        {open && (
          <div className="space-y-4">
            {openLatest ? (
              <section className="space-y-2" aria-label="On file now">
                <h3 className="text-overline text-muted">On file now</h3>
                <FileLine doc={openLatest} />
                <StatusNote doc={openLatest} />
              </section>
            ) : (
              <p className="rounded-lg bg-surface p-3 text-body-sm text-muted">Nothing uploaded yet. {open.isRequired ? "The Foundation needs this document to complete your record." : "Add it if you have one — it strengthens your trainer record."}</p>
            )}

            <section className="space-y-2" aria-label={openLatest ? "Upload a new version" : "Upload"}>
              {openLatest?.status === "VERIFIED" && (
                <p className="rounded-lg border border-warning/30 bg-warning-light/50 p-3 text-body-sm text-ink">A new file replaces the verified one on your record and goes back to the Foundation for verification.</p>
              )}
              {uploader(open, openLatest, "-sheet")}
            </section>

            {openDocs.length > 1 && (
              <section className="space-y-2" aria-label="Earlier uploads">
                <h3 className="text-overline text-muted">Earlier uploads</h3>
                <ul className="space-y-2">
                  {openDocs.slice(1).map((d) => (
                    <li key={d.id} className="flex items-center gap-2">
                      <FileLine doc={d} className="min-w-0 flex-1" />
                      <StatusBadge status={d.status} className="shrink-0" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </ResponsiveSheet>
    </div>
  );
}
