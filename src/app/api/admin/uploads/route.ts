import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { saveUpload, UPLOAD_PRESETS, type UploadPreset } from "@/lib/storage";

/**
 * Generic upload for admin/staff (course images, center photos, CMS media, logos).
 * multipart form: file, preset (image|document|material|resume|csv), folder, visibility (public|private)
 * Returns { key, url, name, mimeType, size }.
 */
export const POST = apiHandler({ roles: ["SUPER_ADMIN", "STAFF"], rateLimit: { limit: 120, windowSec: 600, keyBy: "user", name: "admin-upload" } }, async ({ req }) => {
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("No file uploaded");
  const preset = String(fd.get("preset") ?? "image");
  if (!(preset in UPLOAD_PRESETS)) throw Errors.badRequest("Invalid preset");
  const folder = String(fd.get("folder") ?? "media").replace(/[^a-zA-Z0-9_\-/]/g, "").slice(0, 80) || "media";
  const visibility = fd.get("visibility") === "private" ? "private" : "public";
  return saveUpload(file, { folder: `${visibility === "private" ? "staff/" : ""}${folder}`, visibility, preset: preset as UploadPreset });
});
