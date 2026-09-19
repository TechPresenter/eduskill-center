import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { getTrainerDetail } from "@/server/trainers";
import { normalizeEmail, normalizeMobile } from "@/server/auth";
import { emailSchema, mobileSchema, stringList } from "@/lib/validation/common";

export const GET = apiHandler<{ id: string }>({ permission: "trainers.view" }, async ({ params }) => getTrainerDetail(params.id));

const editSchema = z.object({
  name: z.string().trim().min(2, "Enter the trainer's name").max(120),
  email: emailSchema,
  mobile: mobileSchema,
  qualification: z.string().trim().max(200).optional().nullable(),
  skills: stringList.default([]),
  languages: stringList.default([]),
  bio: z.string().trim().max(3000).optional().nullable(),
});

/** Edits basic trainer profile + login details (with email/mobile uniqueness checks). */
export const PATCH = apiHandler<{ id: string }>({ permission: "trainers.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, editSchema);
  const trainer = await db.trainer.findFirst({ where: { id: params.id, deletedAt: null }, include: { user: { select: { id: true, name: true, email: true, mobile: true } } } });
  if (!trainer) throw Errors.notFound("Trainer");
  const email = normalizeEmail(body.email);
  const mobile = normalizeMobile(body.mobile);
  const errors: Record<string, string> = {};
  const [emailTaken, mobileTaken] = await Promise.all([
    db.user.findFirst({ where: { email, id: { not: trainer.userId } }, select: { id: true } }),
    db.user.findFirst({ where: { mobile, id: { not: trainer.userId } }, select: { id: true } }),
  ]);
  if (emailTaken) errors.email = "Another account already uses this email";
  if (mobileTaken) errors.mobile = "Another account already uses this mobile number";
  if (Object.keys(errors).length) throw Errors.validation("Please correct the highlighted fields.", errors);

  const [updatedTrainer, updatedUser] = await db.$transaction([
    db.trainer.update({ where: { id: trainer.id }, data: { qualification: body.qualification || null, skills: body.skills, languages: body.languages, bio: body.bio || null } }),
    db.user.update({ where: { id: trainer.userId }, data: { name: body.name, email, mobile } }),
  ]);
  await audit({
    user: user!,
    action: "update",
    module: "trainers",
    recordType: "Trainer",
    recordId: trainer.id,
    description: `${user!.name} edited profile of trainer ${trainer.trainerId} (${updatedUser.name})`,
    oldValue: { name: trainer.user.name, email: trainer.user.email, mobile: trainer.user.mobile, qualification: trainer.qualification, skills: trainer.skills, languages: trainer.languages, bio: trainer.bio },
    newValue: { name: updatedUser.name, email: updatedUser.email, mobile: updatedUser.mobile, qualification: updatedTrainer.qualification, skills: updatedTrainer.skills, languages: updatedTrainer.languages, bio: updatedTrainer.bio },
    ip,
    userAgent,
  });
  return { id: trainer.id };
});
