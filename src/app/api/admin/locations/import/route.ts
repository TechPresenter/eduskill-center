import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { importLocationsCsv } from "@/server/locations";

/**
 * multipart/form-data: file (CSV), commit ("true" to write; otherwise preview only).
 * Columns: state_name or state_code, district_name, district_code (optional), block_name (optional).
 */
export const POST = apiHandler({ permission: "locations.import", rateLimit: { limit: 30, windowSec: 600, keyBy: "user", name: "locations-import" } }, async ({ req, user, ip, userAgent }) => {
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("Upload a CSV file");
  if (file.size > 10 * 1024 * 1024) throw Errors.badRequest("CSV is too large (max 10 MB)");
  const name = (file.name || "").toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".txt")) throw Errors.badRequest("Only .csv files are accepted");
  const text = await file.text();
  const commit = fd.get("commit") === "true";
  return importLocationsCsv(text, { commit }, { user: user!, ip, userAgent });
});
