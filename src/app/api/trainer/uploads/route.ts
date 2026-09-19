import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { saveUpload } from "@/lib/storage";
import { isUuid } from "@/lib/utils";
import { assertBatchAccess } from "@/server/attendance";
import { assertActiveTrainer } from "@/server/trainer-scope";

/**
 * POST /api/trainer/uploads   multipart { file, kind: "photo" | "attachment", batchId? }
 *  - photo      → private/trainers/<trainerId>/photo/…  (profile picture; set via PATCH /api/trainer/profile)
 *  - attachment → private/materials/<batchId>/…        (assignment attachments; batch must be mine)
 */
export const POST = apiHandler({ roles: ["TRAINER"], rateLimit: { limit: 60, windowSec: 600, keyBy: "user", name: "trainer-upload" } }, async ({ req, user }) => {
  const trainer = assertActiveTrainer(user);
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("No file uploaded");
  const kind = String(fd.get("kind") ?? "photo");

  if (kind === "photo") {
    return saveUpload(file, { folder: `trainers/${trainer.id}/photo`, visibility: "private", preset: "image", maxMb: 2 });
  }
  if (kind === "attachment") {
    const batchId = String(fd.get("batchId") ?? "");
    if (!isUuid(batchId)) throw Errors.badRequest("Select a batch");
    await assertBatchAccess(user!, batchId, "progress.update");
    return saveUpload(file, { folder: `materials/${batchId}`, visibility: "private", preset: "material", maxMb: 20 });
  }
  throw Errors.badRequest("Invalid upload kind");
});
