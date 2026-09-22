"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, ExternalLink, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";

export interface ChecklistDoc {
  id: string;
  type: string;
  name: string;
  url: string;
  status: string;
  remarks: string | null;
  createdAt: string;
}

export interface RequiredDoc {
  key: string;
  name: string;
  description?: string | null;
}

/** Required-document checklist with inline upload / re-upload for an application. */
export function DocumentsChecklist({ applicationId, required, uploaded, other, editable, onChange }: { applicationId: string; required: RequiredDoc[]; uploaded: Record<string, ChecklistDoc>; other: ChecklistDoc[]; editable: boolean; /** Called after a successful upload so a client-side host (the apply wizard) can refetch. */ onChange?: () => void }) {
  const router = useRouter();
  const [replacing, setReplacing] = React.useState<string | null>(null);

  const onUploaded = (name: string) => {
    toast.success("Document uploaded", `${name} is now awaiting verification.`);
    setReplacing(null);
    if (onChange) onChange();
    else router.refresh();
  };

  if (required.length === 0 && other.length === 0) {
    return <p className="text-body-sm text-muted">No documents are required for this course.</p>;
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {required.map((r) => {
          const doc = uploaded[r.key];
          const present = !!doc && doc.status !== "REJECTED";
          const isPhoto = r.key === "photo";
          const showUpload = editable && (!doc || doc.status === "REJECTED" || replacing === r.key);
          return (
            <li key={r.key} className="rounded-md border border-line p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  {present ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-line" />}
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {r.name} <span className="text-caption font-normal text-danger">*</span>
                    </p>
                    {r.description && <p className="text-caption text-muted">{r.description}</p>}
                    {doc && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-caption">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-navy hover:underline">
                          {doc.name} <ExternalLink className="h-3 w-3" />
                        </a>
                        <StatusBadge status={doc.status} />
                        <span className="text-muted">Uploaded {formatDate(doc.createdAt)}</span>
                      </div>
                    )}
                    {doc?.status === "REJECTED" && <p className="mt-1 text-caption font-medium text-danger">Rejected{doc.remarks ? `: ${doc.remarks}` : ""}. Please upload a clearer copy.</p>}
                    {doc?.status === "VERIFIED" && doc.remarks && <p className="mt-1 text-caption text-muted">Remarks: {doc.remarks}</p>}
                  </div>
                </div>
                {editable && doc && doc.status === "PENDING" && replacing !== r.key && (
                  <Button size="sm" variant="outline" onClick={() => setReplacing(r.key)} leftIcon={<RefreshCw className="h-4 w-4" />} className="shrink-0">
                    Replace
                  </Button>
                )}
              </div>
              {showUpload && (
                <div className="mt-3">
                  <FileUpload
                    endpoint="/api/student/documents"
                    fields={{ type: r.key, applicationId }}
                    accept={isPhoto ? ".jpg,.jpeg,.png,.webp" : ".jpg,.jpeg,.png,.webp,.pdf"}
                    maxSizeMb={5}
                    value={null}
                    sources={["camera", "gallery", "files"]}
                    capture="environment"
                    onChange={(f) => f && onUploaded(r.name)}
                    label={doc ? `Upload new ${r.name}` : `Upload ${r.name}`}
                    hint={isPhoto ? "JPG / PNG up to 5 MB" : "PDF / JPG / PNG up to 5 MB"}
                  />
                  {replacing === r.key && (
                    <button type="button" className="mt-1 inline-flex min-h-11 items-center text-body-sm font-medium text-muted hover:text-ink" onClick={() => setReplacing(null)}>
                      Keep the current file
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {other.length > 0 && (
        <div>
          <p className="mb-2 text-caption font-semibold tracking-wide text-muted uppercase">Other documents on file</p>
          <ul className="space-y-2">
            {other.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-body-sm">
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-navy hover:underline">
                  {d.name} <ExternalLink className="h-3 w-3" />
                </a>
                <span className="flex items-center gap-2 text-caption text-muted">
                  {d.type.replace(/_/g, " ")} <StatusBadge status={d.status} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
