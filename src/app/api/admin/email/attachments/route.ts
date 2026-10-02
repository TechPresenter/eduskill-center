import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { fileUrl } from "@/lib/storage";
import { uploadEmailAttachment } from "@/server/email";

/**
 * Uploads one attachment (multipart `file`) as a PRIVATE file under private/email/<adminId>/.
 * Extension, declared type, magic bytes and size (Settings → email.maxAttachmentMb) are checked by
 * the storage layer. `url` is the access-controlled /api/files link, used only for the sender's own
 * attachment preview.
 */
export const POST = apiHandler({ permission: "email.send", rateLimit: { limit: 60, windowSec: 600, keyBy: "user", name: "admin-email-attachment" } }, async ({ req, user, ip, userAgent }) => {
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    throw Errors.badRequest("Choose a file to attach");
  }
  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("Choose a file to attach");
  const stored = await uploadEmailAttachment(file, { user: user!, ip, userAgent });
  return { ...stored, url: fileUrl(stored.key) };
});
