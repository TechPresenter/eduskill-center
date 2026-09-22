"use client";

import { Download, FileText, Film, Image as ImageIcon, MoreVertical, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";

/** One row of GET /api/trainer/materials. */
export interface MaterialRow {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string | null;
  createdAt: string;
  batch: { id: string; code: string; name: string } | null;
  course: { id: string; name: string } | null;
}

const IMAGE_TYPES = ["png", "jpg", "jpeg", "webp", "gif"];

function FileGlyph({ type }: { type: string | null }) {
  const t = (type ?? "").toLowerCase();
  const Icon = IMAGE_TYPES.includes(t) ? ImageIcon : t === "mp4" ? Film : FileText;
  return <Icon className="h-5 w-5" aria-hidden />;
}

/**
 * One uploaded study material: type tile, title, which batch it belongs to, an optional description
 * and the two things a trainer does with it — open it, or remove it. Delete lives behind a 44px
 * overflow menu (a sheet on phones) so it can never be hit by accident while scrolling.
 */
export function MaterialCard({ material: m, canDelete, onDelete }: { material: MaterialRow; canDelete: boolean; onDelete: () => void }) {
  return (
    <li className="card card-p flex flex-col">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">
          <FileGlyph type={m.fileType} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-h4 text-navy">{m.title}</h3>
          <p className="mt-0.5 truncate text-caption text-muted">{m.batch ? `${m.batch.name} · ${m.batch.code}` : (m.course?.name ?? "Course material")}</p>
        </div>
        <Badge tone="neutral" className="shrink-0">
          {(m.fileType ?? "file").toUpperCase()}
        </Badge>
      </div>

      {m.description && <p className="mt-3 line-clamp-3 text-body-sm text-muted">{m.description}</p>}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="min-w-0 truncate text-caption text-muted">{formatDateTime(m.createdAt)}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={m.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line bg-white px-3.5 text-body-sm font-semibold text-ink ring-focus transition duration-micro hover:border-navy/40 hover:bg-surface active:scale-[0.98] motion-reduce:transition-none sm:min-h-9"
          >
            <Download className="h-4 w-4" aria-hidden /> Open
          </a>
          <Dropdown mobileTitle={m.title} trigger={<IconButton size="md" variant="ghost" aria-label={`More actions for ${m.title}`} icon={<MoreVertical className="h-5 w-5" />} />}>
            <DropdownItem onClick={onDelete} disabled={!canDelete} danger icon={<Trash2 className="h-4 w-4" />}>
              Delete material
            </DropdownItem>
          </Dropdown>
        </div>
      </div>
    </li>
  );
}
