import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { hasPermission } from "@/lib/rbac/permissions";
import { saveUpload, UPLOAD_PRESETS, type UploadPreset } from "@/lib/storage";

/**
 * Permissions that may write a PUBLIC file (served to anyone who has its URL). One of them is
 * required because a public upload is effectively publishing: the callers are the CMS (sections,
 * pages, blog, events, gallery, programmes, stories, partners → cms.update), course images
 * (courses.create / courses.update), centre cover + gallery photos (centers.create /
 * centers.update), donation campaign images (donations.update), branding logos in Settings
 * (settings.update) and images inlined in a composed email (email.send / email.templates).
 * Keep this list in step with the screens that render `ImageField` / `FileUpload` against this
 * endpoint.
 */
const PUBLIC_UPLOAD_PERMISSIONS = [
  "cms.update",
  "courses.create",
  "courses.update",
  "centers.create",
  "centers.update",
  "donations.update",
  "settings.update",
  "email.send",
  "email.templates",
];

/**
 * Generic upload for admin/staff (course images, center photos, CMS media, logos).
 * multipart form: file, preset (image|document|material|resume|csv), folder, visibility (public|private)
 * Returns { key, url, name, mimeType, size }.
 *
 * Private writes land under `private/staff/…` and are readable only through the access-controlled
 * files route, so any signed-in administrator may make one. Public writes need one of
 * PUBLIC_UPLOAD_PERMISSIONS.
 */
export const POST = apiHandler({ roles: ["SUPER_ADMIN", "STAFF"], rateLimit: { limit: 120, windowSec: 600, keyBy: "user", name: "admin-upload" } }, async ({ req, user }) => {
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("No file uploaded");
  const preset = String(fd.get("preset") ?? "image");
  if (!(preset in UPLOAD_PRESETS)) throw Errors.badRequest("Invalid preset");
  const folder = String(fd.get("folder") ?? "media").replace(/[^a-zA-Z0-9_\-/]/g, "").slice(0, 80) || "media";
  const visibility = fd.get("visibility") === "private" ? "private" : "public";
  if (visibility === "public" && !hasPermission(user, PUBLIC_UPLOAD_PERMISSIONS)) throw Errors.forbidden("You do not have permission to publish files");
  return saveUpload(file, { folder: `${visibility === "private" ? "staff/" : ""}${folder}`, visibility, preset: preset as UploadPreset });
});
