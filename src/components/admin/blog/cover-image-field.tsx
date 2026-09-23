"use client";

import * as React from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export interface CoverImageFieldProps {
  /** Stored URL (`/api/files/public/blog/…` or an https address). Empty means "no image yet". */
  value: string;
  alt?: string;
  onChange: (url: string) => void;
  /**
   * Omit to hide the alt-text field entirely. The cover needs one (it is rendered on the article
   * and in the listing); the social-preview slot has no `alt` column to write to, because a link
   * preview image is described by the post title, not by markup we control.
   */
  onAltChange?: (alt: string) => void;
  /** Id for the alt input, so the form's ErrorSummary can jump to it. */
  altId?: string;
  error?: string;
  altError?: string;
  disabled?: boolean;
  folder?: string;
  label?: string;
  /**
   * Replaces the default uploader hint (the social slot wants different dimensions). Plain text,
   * not a node: it is handed straight to `FileUpload`, which renders it as the label of the drop
   * zone and of the touch tiles — both of which are `<span>`s of running text with no room for
   * markup.
   */
  hint?: string;
}

/**
 * The blog's cover-image control: upload → 16:9 preview → Replace / Remove, plus the alt text.
 *
 * Unlike the generic `ImageField` in `@/components/admin/content/fields` there is NO "use an image
 * URL instead" escape hatch. A pasted third-party URL is a broken image waiting to happen (it can
 * 404, hotlink, or be an un-configured host that `next/image` refuses), and the blog is the one
 * place in the product where the picture is the first thing a reader sees. `coverImage` is Zod-
 * constrained to `^(\/|https:\/\/)` on the server for the same reason.
 *
 * The preview is a plain `<img>` inside the shared `media media-16x9` frame rather than
 * `next/image`: this is an editor preview, not a page render, and `saveUpload`/`fileUrl` already
 * applied the deployment base path to the stored value — calling `withBasePath` again would
 * double-prefix it under a `/center` deployment.
 */
export function CoverImageField({ value, alt = "", onChange, onAltChange, altId, error, altError, disabled, folder = "blog", label = "Cover image", hint }: CoverImageFieldProps) {
  // Replacing re-mounts the uploader over the existing image; `uploadKey` resets the FileUpload's
  // own internal error / progress state so a failed first attempt does not linger on the second.
  const [replacing, setReplacing] = React.useState(false);
  const [uploadKey, setUploadKey] = React.useState(0);
  const generatedAltId = React.useId();
  const altInputId = altId ?? `${generatedAltId}-alt`;

  const fileName = value ? decodeURIComponent(value.split("/").pop() ?? value) : "";
  const showUploader = !value || replacing;

  const uploader = (
    <FileUpload
      key={uploadKey}
      endpoint="/api/admin/uploads"
      fields={{ preset: "image", folder, visibility: "public" }}
      accept=".jpg,.jpeg,.png,.webp"
      maxSizeMb={5}
      value={null}
      onChange={(f) => {
        if (!f) return;
        onChange(f.url);
        setReplacing(false);
      }}
      label={value ? "Upload a new image" : `Upload ${label.toLowerCase()}`}
      hint={hint ?? "JPG, PNG or WEBP up to 5 MB. 1600×900 or larger looks best."}
      disabled={disabled}
    />
  );

  return (
    <div className="space-y-3">
      <Field label={label} error={error} className="space-y-2">
        {showUploader ? (
          <div className="space-y-2">
            {uploader}
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setReplacing(false)} disabled={disabled}>
                Keep the current image
              </Button>
            )}
            {!value && (
              // Said here rather than under a preview, because this is the only state in which it is
              // true — and it is reassurance, not a warning: an article without a picture still looks
              // finished on the website.
              <p className="text-caption text-muted">No cover? The site draws a branded pattern from the post&rsquo;s address instead.</p>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <span className="media media-16x9 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt={alt || ""} loading="lazy" decoding="async" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-navy/70 px-3 py-1.5 text-caption font-medium text-white" title={value}>
                {fileName}
              </span>
            </span>
            {!disabled && (
              <div className="flex items-center justify-between gap-2 border-t border-line p-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                  onClick={() => {
                    setUploadKey((k) => k + 1);
                    setReplacing(true);
                  }}
                >
                  Replace
                </Button>
                <IconButton
                  size="md"
                  icon={<Trash2 className="h-4 w-4" />}
                  aria-label={`Remove ${label.toLowerCase()}`}
                  className="hover:bg-danger-light hover:text-danger"
                  onClick={() => {
                    onChange("");
                    onAltChange?.("");
                    setReplacing(false);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </Field>

      {onAltChange && (
        <Field
          label="Image description (alt text)"
          htmlFor={altInputId}
          /* Only meaningful once there is a picture to describe; a red asterisk on a disabled,
             empty control reads as a bug rather than as a requirement. */
          required={!!value}
          error={altError}
          hint="What the picture shows. Screen readers and Google read this."
        >
          <Input
            id={altInputId}
            value={alt}
            onChange={(e) => onAltChange(e.target.value)}
            maxLength={200}
            placeholder={value ? "e.g. Trainees at the Patna centre working on desktop computers" : "Add an image first"}
            invalid={!!altError}
            disabled={disabled || !value}
          />
        </Field>
      )}
    </div>
  );
}
