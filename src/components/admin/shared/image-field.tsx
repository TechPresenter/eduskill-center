"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { cn } from "@/lib/utils";

/**
 * Image upload bound to a plain URL string. Uploads go to POST /api/admin/uploads
 * (preset `image`, public) and the returned file URL is stored on the record.
 */
export function ImageField({ value, onChange, folder, disabled, hint, className, previewClassName }: { value: string; onChange: (url: string) => void; folder: string; disabled?: boolean; hint?: string; className?: string; previewClassName?: string }) {
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const shown = file?.url === value ? file : null;

  if (value) {
    return (
      <div className={cn("flex items-center gap-3 rounded-card border border-line bg-white p-3", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" className={cn("h-14 w-20 rounded-md border border-line object-cover sm:h-16 sm:w-24", previewClassName)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{shown?.name ?? value.split("/").pop()}</p>
          <p className="truncate text-xs text-muted" title={value}>{value}</p>
        </div>
        {!disabled && (
          <IconButton
            aria-label="Remove image"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              setFile(null);
              onChange("");
            }}
            className="hover:bg-danger-light hover:text-danger"
          />
        )}
      </div>
    );
  }

  return (
    <FileUpload
      className={className}
      endpoint="/api/admin/uploads"
      fields={{ preset: "image", folder, visibility: "public" }}
      accept=".jpg,.jpeg,.png,.webp"
      maxSizeMb={5}
      value={null}
      disabled={disabled}
      label="Upload image"
      hint={hint ?? "JPG, PNG or WEBP up to 5 MB"}
      onChange={(f) => {
        setFile(f);
        onChange(f?.url ?? "");
      }}
    />
  );
}
