"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { FileUpload } from "@/components/ui/file-upload";
import { ConfirmDialog } from "@/components/ui/modal";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { formatBytes, formatDate, titleCase } from "@/lib/utils";
import { AddDocumentCard, DocumentCard } from "@/components/student/mobile/document-card";

interface DocType {
  key: string;
  name: string;
  description: string | null;
  isRequired: boolean;
}
interface Doc {
  id: string;
  type: string;
  name: string;
  url: string;
  status: string;
  remarks: string | null;
  createdAt: string;
  size: number | null;
  mimeType: string | null;
}

const ACCEPT_IMAGE = ".jpg,.jpeg,.png,.webp";
const ACCEPT_DOC = ".jpg,.jpeg,.png,.webp,.pdf";

export function DocumentsManager({ types, documents }: { types: DocType[]; documents: Doc[] }) {
  const router = useRouter();
  const [replacing, setReplacing] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<Doc | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetType, setSheetType] = React.useState(types[0]?.key ?? "");

  const byType = new Map<string, Doc[]>();
  for (const d of documents) byType.set(d.type, [...(byType.get(d.type) ?? []), d]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/api/student/documents/${deleting.id}`);
      toast.success("Document removed");
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error("Could not remove", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const knownKeys = new Set(types.map((t) => t.key));
  const orphaned = documents.filter((d) => !knownKeys.has(d.type));
  const sheetTypeName = types.find((t) => t.key === sheetType)?.name ?? "document";

  const uploader = (t: DocType, latest: Doc | null) => (
    <FileUpload
      endpoint="/api/student/documents"
      fields={{ type: t.key }}
      accept={t.key === "photo" ? ACCEPT_IMAGE : ACCEPT_DOC}
      maxSizeMb={5}
      value={null}
      sources={["camera", "gallery", "files"]}
      capture="environment"
      onChange={(f) => {
        if (!f) return;
        toast.success("Document uploaded", `${t.name} is awaiting verification.`);
        setReplacing(null);
        router.refresh();
      }}
      label={latest ? `Upload new ${t.name}` : `Upload ${t.name}`}
      hint={t.key === "photo" ? "JPG / PNG up to 5 MB" : "PDF / JPG / PNG up to 5 MB"}
    />
  );

  const keepCurrent = () => (
    <button type="button" className="mt-1 inline-flex min-h-11 items-center text-body-sm font-medium text-muted hover:text-ink" onClick={() => setReplacing(null)}>
      Keep the current file
    </button>
  );

  return (
    <div>
      {/* ───────── Phones & tablets: one card per document type ───────── */}
      <ul className="space-y-3 lg:hidden">
        {types.map((t) => {
          const docs = byType.get(t.key) ?? [];
          const latest = docs[0] ?? null;
          const showUpload = !latest || latest.status === "REJECTED" || replacing === t.key;
          return (
            <DocumentCard
              key={t.key}
              title={t.name}
              description={t.description}
              required={t.isRequired}
              doc={latest}
              onReplace={latest && latest.status !== "REJECTED" && replacing !== t.key ? () => setReplacing(t.key) : undefined}
              onRemove={latest ? () => setDeleting(latest) : undefined}
            >
              {showUpload && (
                <>
                  {uploader(t, latest)}
                  {replacing === t.key && keepCurrent()}
                </>
              )}
            </DocumentCard>
          );
        })}
        {orphaned.map((d) => (
          <DocumentCard key={d.id} title={titleCase(d.type.replace(/_/g, " "))} description="Uploaded for a document type that is no longer active." doc={d} onRemove={() => setDeleting(d)} />
        ))}
        <AddDocumentCard onClick={() => setSheetOpen(true)} label="Upload another document" hint="Pick the type, then use your camera or files" />
      </ul>

      {/* ───────── Desktop (lg+): unchanged layout ───────── */}
      <div className="hidden space-y-4 lg:block">
        {types.map((t) => {
          const docs = byType.get(t.key) ?? [];
          const latest = docs[0] ?? null;
          const isPhoto = t.key === "photo";
          const showUpload = !latest || latest.status === "REJECTED" || replacing === t.key;
          return (
            <Card key={t.key}>
              <CardHeader
                title={t.name}
                description={
                  <span className="flex flex-wrap items-center gap-2">
                    {t.isRequired ? <Badge tone="orange">Required</Badge> : <Badge tone="neutral">Optional</Badge>}
                    {t.description && <span>{t.description}</span>}
                  </span>
                }
                action={latest && latest.status === "PENDING" && replacing !== t.key ? <Button size="xs" variant="ghost" onClick={() => setReplacing(t.key)} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Replace</Button> : undefined}
              />
              <CardBody className="space-y-3">
                {docs.map((d) => (
                  <div key={d.id} className="flex flex-col gap-2 rounded-md border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 truncate text-body-sm font-medium text-navy hover:underline">
                          {d.name} <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                        <p className="text-caption text-muted">
                          Uploaded {formatDate(d.createdAt)}
                          {d.size ? ` · ${formatBytes(d.size)}` : ""}
                        </p>
                        {d.status === "REJECTED" && <p className="text-caption font-medium text-danger">Rejected{d.remarks ? `: ${d.remarks}` : ""}</p>}
                        {d.status === "VERIFIED" && d.remarks && <p className="text-caption text-muted">Remarks: {d.remarks}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={d.status} />
                      {d.status !== "VERIFIED" && (
                        <Button size="xs" variant="ghost" onClick={() => setDeleting(d)} aria-label={`Remove ${d.name}`} leftIcon={<Trash2 className="h-3.5 w-3.5 text-danger" />}>
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {showUpload && (
                  <div>
                    <FileUpload
                      endpoint="/api/student/documents"
                      fields={{ type: t.key }}
                      accept={isPhoto ? ACCEPT_IMAGE : ACCEPT_DOC}
                      maxSizeMb={5}
                      value={null}
                      onChange={(f) => {
                        if (!f) return;
                        toast.success("Document uploaded", `${t.name} is awaiting verification.`);
                        setReplacing(null);
                        router.refresh();
                      }}
                      label={latest ? `Upload new ${t.name}` : `Upload ${t.name}`}
                      hint={isPhoto ? "JPG / PNG up to 5 MB" : "PDF / JPG / PNG up to 5 MB"}
                    />
                    {replacing === t.key && keepCurrent()}
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}

        {orphaned.length > 0 && (
          <Card>
            <CardHeader title="Other documents" description="Uploaded for document types that are no longer active." />
            <CardBody className="space-y-2">
              {orphaned.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-body-sm">
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-medium text-navy hover:underline">
                    {d.name}
                  </a>
                  <span className="flex items-center gap-2 text-caption text-muted">
                    {d.type.replace(/_/g, " ")} <StatusBadge status={d.status} />
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        )}
      </div>

      <ResponsiveSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Upload a document" description="Choose the document type, then take a photo or pick a file.">
        <div className="space-y-4">
          <Field label="Document type" htmlFor="sheetDocType" required>
            <Select id="sheetDocType" value={sheetType} onChange={(e) => setSheetType(e.target.value)} options={types.map((t) => ({ value: t.key, label: t.isRequired ? `${t.name} (required)` : t.name }))} />
          </Field>
          <FileUpload
            key={sheetType}
            endpoint="/api/student/documents"
            fields={{ type: sheetType }}
            accept={sheetType === "photo" ? ACCEPT_IMAGE : ACCEPT_DOC}
            maxSizeMb={5}
            value={null}
            sources={["camera", "gallery", "files"]}
            capture="environment"
            onChange={(f) => {
              if (!f) return;
              toast.success("Document uploaded", `${sheetTypeName} is awaiting verification.`);
              setSheetOpen(false);
              router.refresh();
            }}
            label={`Upload ${sheetTypeName}`}
            hint={sheetType === "photo" ? "JPG / PNG up to 5 MB" : "PDF / JPG / PNG up to 5 MB"}
          />
        </div>
      </ResponsiveSheet>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} loading={busy} danger title="Remove this document?" confirmLabel="Remove" description={deleting ? `${deleting.name} will be deleted. You can upload a new file afterwards.` : undefined} />
    </div>
  );
}
