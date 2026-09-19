import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { toNumber } from "@/lib/utils";

const schema = z.object({
  centerId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  featured: z.union([z.literal("true"), z.literal("false")]).optional(),
});

/** Active courses (optionally offered at a given center). */
export const GET = apiHandler({ auth: "none", csrf: false }, async ({ req }) => {
  const q = parseQuery(req, schema);
  const courses = await db.course.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      categoryId: q.categoryId,
      ...(q.featured === "true" ? { isFeatured: true } : {}),
      ...(q.centerId ? { centers: { some: { centerId: q.centerId, isActive: true } } } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      slug: true,
      name: true,
      shortDescription: true,
      image: true,
      icon: true,
      durationText: true,
      level: true,
      mode: true,
      courseFee: true,
      registrationFee: true,
      examFee: true,
      certificateFee: true,
      scholarshipAvailable: true,
      minAge: true,
      maxAge: true,
      eligibility: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  });
  return {
    courses: courses.map((c) => ({
      ...c,
      courseFee: toNumber(c.courseFee),
      registrationFee: toNumber(c.registrationFee),
      examFee: toNumber(c.examFee),
      certificateFee: toNumber(c.certificateFee),
      totalFee: toNumber(c.courseFee) + toNumber(c.registrationFee) + toNumber(c.examFee) + toNumber(c.certificateFee),
    })),
  };
});
