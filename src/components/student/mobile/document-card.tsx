"use client";

import * as React from "react";
import { ExternalLink, FileText, Image as ImageIcon, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import { withBasePath } from "@/lib/base-path";

export interface DocumentCardFile {
  id: string;
  name: string;
  url: string;
  status: string;
  remarks: string | null;
  createdAt: string;
  size: number | null;
  mimeType: string | null;
}

export interface DocumentCardProps {
  /** Document type name, e.g. "Aadhaar card". */
  title: string;
  description?: string | null;
  required?: boolean;
  /** The latest uploaded file for this type, if any. */
  doc?: DocumentCardFile | null;
  /** Replace action (hidden when omitted or while the uploader is open). */
  onReplace?: () => void;
  /** Remove action; automatically hidden for VERIFIED documents. */
  onRemove?: () => void;
  /** Uploader (FileUpload) rendered inside the card when no file exists or a replacement was requested. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Phone-sized card for one document type: 56px thumbnail (image preview when the stored file is an image),
 * truncated filename, `size · uploaded date`, status badge and 44px Replace / Remove actions.
 * Renders the uploader passed as `children` when there is nothing on file yet.
 */
export function DocumentCard({ title, description, required, doc, onReplace, onRemove, children, className }: DocumentCardProps) {
  const isImage = !!doc?.mimeType?.startsWith("image/");
  const canRemove = !!doc && doc.status !== "VERIFIED" && !!onRemove;
  return (
    <li className={cn("card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{title}</p>
          {description && <p className="mt-0.5 text-caption text-muted">{description}</p>}
        </div>
        {doc ? <StatusBadge status={doc.status} /> : required ? <Badge tone="orange">Required</Badge> : <Badge tone="neutral">Optional</Badge>}
      </div>

      {doc && (
        <div className="mt-3 flex items-center gap-3">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBasePath(doc.url)} alt={doc.name} width={56} height={56} loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-md border border-line object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">{doc.mimeType?.includes("pdf") ? <FileText className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}</div>
          )}
          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block min-w-0 flex-1 py-1.5 tap-highlight-none">
            <span className="flex items-center gap-1 text-body-sm font-medium text-navy">
              <span className="truncate">{doc.name}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </span>
            <span className="mt-0.5 block text-caption text-muted">
              {doc.size ? `${formatBytes(doc.size)} · ` : ""}
              {formatDate(doc.createdAt)}
            </span>
          </a>
        </div>
      )}

      {doc?.status === "REJECTED" && <p className="mt-2 text-body-sm font-medium text-danger">Rejected{doc.remarks ? `: ${doc.remarks}` : ""}. Please upload a clearer copy.</p>}
      {doc?.status === "VERIFIED" && doc.remarks && <p className="mt-2 text-caption text-muted">Remarks: {doc.remarks}</p>}

      {doc && (onReplace || canRemove) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {onReplace ? (
            <Button variant="outline" size="md" onClick={onReplace} leftIcon={<RefreshCw className="h-4 w-4" />} className="min-h-11">
              Replace
            </Button>
          ) : (
            <span />
          )}
          {canRemove && (
            <Button variant="outline" size="md" onClick={onRemove} leftIcon={<Trash2 className="h-4 w-4 text-danger" />} className="min-h-11">
              Remove
            </Button>
          )}
        </div>
      )}

      {children && <div className="mt-3">{children}</div>}
    </li>
  );
}

/** Dashed "add another document" tile that opens a sheet with a type picker + uploader. */
export function AddDocumentCard({ onClick, label = "Upload document", hint }: { onClick: () => void; label?: string; hint?: string }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-line bg-white/60 px-4 py-4 text-center tap-highlight-none transition-colors motion-reduce:transition-none active:bg-lavender/60 hover:border-navy/40"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lavender text-navy">
          <Plus className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-body-sm font-semibold text-navy">{label}</span>
        {hint && <span className="text-caption text-muted">{hint}</span>}
      </button>
    </li>
  );
}
