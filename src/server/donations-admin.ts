import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import type { DonationStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { toNumber } from "@/lib/utils";
import { money, optionalDateString, optionalString, slugSchema } from "@/lib/validation/common";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalDate } from "@/lib/api/query";
import { uniqueContentSlug, type Ctx } from "@/server/cms-admin";
import { notifyDonationCompleted } from "@/server/donations";

export type { Ctx };

// ───────────────────────────── Campaigns ─────────────────────────────

export const campaignSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a title").max(200),
    slug: z.union([z.literal(""), slugSchema]).optional().nullable(),
    description: z.string().trim().max(10_000).optional().nullable(),
    image: optionalString,
    goalAmount: z.union([z.literal(""), money]).optional().nullable().transform((v) => (v === "" || v === undefined || v === null ? null : v)),
    startDate: optionalDateString,
    endDate: optionalDateString,
    isActive: z.coerce.boolean().default(true),
  })
  .superRefine((d, ctx) => {
    if (d.startDate && d.endDate && d.endDate < d.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after the start date" });
  });
export type CampaignInput = z.infer<typeof campaignSchema>;

function serializeCampaign<T extends { goalAmount: unknown; raisedAmount: unknown }>(c: T) {
  return { ...c, goalAmount: c.goalAmount === null ? null : toNumber(c.goalAmount), raisedAmount: toNumber(c.raisedAmount) };
}

export async function listCampaigns() {
  const [items, sums] = await Promise.all([
    db.campaign.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }], include: { _count: { select: { donations: true } } } }),
    db.donation.groupBy({ by: ["campaignId"], where: { status: "COMPLETED", campaignId: { not: null } }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const byCampaign = new Map(sums.map((s) => [s.campaignId!, { completedAmount: toNumber(s._sum.amount), completedCount: s._count._all }]));
  return items.map((c) => ({ ...serializeCampaign(c), completedAmount: byCampaign.get(c.id)?.completedAmount ?? 0, completedCount: byCampaign.get(c.id)?.completedCount ?? 0 }));
}

export async function createCampaign(input: CampaignInput, ctx: Ctx) {
  const slug = await uniqueContentSlug("campaign", input.slug || input.title);
  const c = await db.campaign.create({ data: { title: input.title, slug, description: input.description || null, image: input.image || null, goalAmount: input.goalAmount, startDate: input.startDate, endDate: input.endDate, isActive: input.isActive } });
  await audit({ user: ctx.user, action: "create", module: "donations", recordType: "Campaign", recordId: c.id, description: `${ctx.user.name} created donation campaign "${c.title}"`, newValue: serializeCampaign(c), ip: ctx.ip, userAgent: ctx.userAgent });
  return serializeCampaign(c);
}

export async function updateCampaign(id: string, input: CampaignInput, ctx: Ctx) {
  const existing = await db.campaign.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Campaign");
  const slug = input.slug && input.slug !== existing.slug ? await uniqueContentSlug("campaign", input.slug, id) : existing.slug;
  const c = await db.campaign.update({ where: { id }, data: { title: input.title, slug, description: input.description || null, image: input.image || null, goalAmount: input.goalAmount, startDate: input.startDate, endDate: input.endDate, isActive: input.isActive } });
  await audit({ user: ctx.user, action: "update", module: "donations", recordType: "Campaign", recordId: id, description: `${ctx.user.name} updated donation campaign "${c.title}"`, oldValue: serializeCampaign(existing), newValue: serializeCampaign(c), ip: ctx.ip, userAgent: ctx.userAgent });
  return serializeCampaign(c);
}

export async function deleteCampaign(id: string, ctx: Ctx) {
  const existing = await db.campaign.findUnique({ where: { id }, include: { _count: { select: { donations: true } } } });
  if (!existing) throw Errors.notFound("Campaign");
  if (existing._count.donations > 0) throw Errors.conflict("This campaign has donations recorded against it. Deactivate it instead of deleting.");
  await db.campaign.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "donations", recordType: "Campaign", recordId: id, description: `${ctx.user.name} deleted donation campaign "${existing.title}"`, oldValue: serializeCampaign(existing), ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Donations ─────────────────────────────

export const donationListSchema = paginationSchema.extend({
  status: z.string().optional(),
  campaignId: optionalUuid,
  gateway: z.string().trim().max(40).optional(),
  from: optionalDate,
  to: optionalDate,
});

function donationWhere(q: z.infer<typeof donationListSchema>): Prisma.DonationWhereInput {
  const where: Prisma.DonationWhereInput = {};
  if (q.status) where.status = { in: q.status.split(",") as DonationStatus[] };
  if (q.campaignId) where.campaignId = q.campaignId;
  if (q.gateway) where.gateway = q.gateway;
  if (q.from || q.to) where.createdAt = { gte: q.from, lt: q.to ? new Date(q.to.getTime() + 86400000) : undefined };
  if (q.q) where.OR = [{ donationNo: { contains: q.q, mode: "insensitive" } }, { donorName: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }, { mobile: { contains: q.q } }, { gatewayPaymentId: { contains: q.q, mode: "insensitive" } }, { gatewayOrderId: { contains: q.q, mode: "insensitive" } }];
  return where;
}

export function serializeDonation<T extends { amount: unknown; isAnonymous: boolean; donorName: string }>(d: T) {
  return { ...d, amount: toNumber(d.amount), donorDisplay: d.isAnonymous ? "Anonymous donor" : d.donorName };
}

export async function listDonations(q: z.infer<typeof donationListSchema>) {
  const where = donationWhere(q);
  const orderBy = buildOrderBy(q.sort, q.order, ["createdAt", "amount", "status", "donorName"] as const, "createdAt");
  const [items, total, totals] = await Promise.all([
    db.donation.findMany({ where, orderBy, ...getPaging(q), include: { campaign: { select: { id: true, title: true } } } }),
    db.donation.count({ where }),
    db.donation.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  return { ...paged(items.map(serializeDonation), total, q), completedAmount: toNumber(totals._sum.amount), completedCount: totals._count._all };
}

export async function exportDonationsCsv(q: z.infer<typeof donationListSchema>) {
  const rows = await db.donation.findMany({ where: donationWhere(q), orderBy: { createdAt: "desc" }, take: 5000, include: { campaign: { select: { title: true } } } });
  return rows.map((d) => ({
    donationNo: d.donationNo,
    date: d.createdAt.toISOString(),
    donor: d.isAnonymous ? "Anonymous" : d.donorName,
    email: d.isAnonymous ? "" : (d.email ?? ""),
    mobile: d.isAnonymous ? "" : (d.mobile ?? ""),
    pan: d.isAnonymous ? "" : (d.pan ?? ""),
    amount: toNumber(d.amount),
    currency: d.currency,
    campaign: d.campaign?.title ?? "",
    status: d.status,
    gateway: d.gateway,
    gatewayOrderId: d.gatewayOrderId ?? "",
    gatewayPaymentId: d.gatewayPaymentId ?? "",
    message: d.message ?? "",
  }));
}

export const donationStatusSchema = z.object({ status: z.enum(["COMPLETED", "FAILED"]), note: z.string().trim().max(500).optional().nullable() });

export async function setDonationStatus(id: string, input: z.infer<typeof donationStatusSchema>, ctx: Ctx) {
  const d = await db.donation.findUnique({ where: { id } });
  if (!d) throw Errors.notFound("Donation");
  if (d.gateway !== "manual") throw Errors.badRequest("Only manual / offline donations can be updated by hand. Gateway donations are reconciled automatically.");
  if (d.status === input.status) throw Errors.badRequest(`This donation is already ${input.status.toLowerCase()}.`);
  if (d.status === "COMPLETED") throw Errors.badRequest("A completed donation cannot be changed.");
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.donation.update({ where: { id }, data: { status: input.status, gatewayPaymentId: input.status === "COMPLETED" && !d.gatewayPaymentId ? `MANUAL-${d.donationNo}` : d.gatewayPaymentId } });
    if (input.status === "COMPLETED" && d.campaignId) {
      await tx.campaign.update({ where: { id: d.campaignId }, data: { raisedAmount: { increment: d.amount } } });
    }
    return u;
  });
  await audit({ user: ctx.user, action: input.status === "COMPLETED" ? "mark_completed" : "mark_failed", module: "donations", recordType: "Donation", recordId: id, description: `${ctx.user.name} marked donation ${d.donationNo} (${toNumber(d.amount)} ${d.currency}) as ${input.status.toLowerCase()}${input.note ? ` – ${input.note}` : ""}`, oldValue: { status: d.status }, newValue: { status: input.status, note: input.note ?? null }, ip: ctx.ip, userAgent: ctx.userAgent });
  if (input.status === "COMPLETED") await notifyDonationCompleted(id);
  return serializeDonation(updated);
}
