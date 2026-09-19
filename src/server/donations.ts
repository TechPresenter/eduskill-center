import { z } from "zod";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { generateDonationNo } from "@/lib/ids";
import { createGatewayOrder, getGatewayConfig, verifyRazorpayCheckoutSignature } from "@/lib/payments";
import { getBranding } from "@/lib/settings";
import { emailSchema, mobileSchema } from "@/lib/validation/common";
import { formatINR, toNumber } from "@/lib/utils";
import { notify, notifyStaff } from "@/lib/notifications";

export const donationInputSchema = z.object({
  donorName: z.string().trim().min(2, "Enter your name").max(120),
  email: z.union([z.literal(""), emailSchema]).optional(),
  mobile: z.union([z.literal(""), mobileSchema]).optional(),
  amount: z.coerce.number().int("Enter a whole rupee amount").min(100, "Minimum donation is ₹100").max(10_000_000, "Please contact us for donations above ₹1 crore"),
  campaignId: z.union([z.literal(""), z.string().uuid()]).optional(),
  message: z.string().trim().max(1000).optional(),
  isAnonymous: z.boolean().optional(),
  pan: z
    .union([z.literal(""), z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN (e.g. ABCDE1234F)")])
    .optional(),
  /** Honeypot */
  website: z.string().max(200).optional(),
});

export type DonationInput = z.infer<typeof donationInputSchema>;

export interface DonationCheckout {
  keyId: string;
  orderId: string;
  /** Amount in paise as Razorpay expects. */
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email?: string; contact?: string };
  notes: Record<string, string>;
}

export interface CreateDonationResult {
  donation: { id: string; donationNo: string; amount: number; status: "PENDING" | "COMPLETED" | "FAILED"; campaignTitle: string | null };
  gateway: "manual" | "razorpay";
  checkout: DonationCheckout | null;
  bankDetails: string | null;
}

/**
 * Creates a PENDING donation. With Razorpay configured, an order is created and checkout
 * parameters are returned; with the manual gateway the donor gets the bank details and the
 * donation number and staff mark it completed after reconciliation. No fake success.
 */
export async function createDonation(input: DonationInput): Promise<CreateDonationResult> {
  if (input.website && input.website.trim().length > 0) throw Errors.badRequest("Request rejected");
  const cfg = await getGatewayConfig();
  const branding = await getBranding();

  let campaign: { id: string; title: string } | null = null;
  if (input.campaignId) {
    campaign = await db.campaign.findFirst({ where: { id: input.campaignId, isActive: true }, select: { id: true, title: true } });
    if (!campaign) throw Errors.validation("Please correct the highlighted fields.", { campaignId: "This campaign is no longer active" });
  }

  const mobile = input.mobile ? input.mobile.replace(/[\s-]/g, "").replace(/^\+?91/, "") : null;
  const donation = await db.$transaction(async (tx) => {
    const donationNo = await generateDonationNo(tx);
    return tx.donation.create({
      data: {
        donationNo,
        campaignId: campaign?.id ?? null,
        donorName: input.donorName,
        email: input.email ? input.email.toLowerCase() : null,
        mobile,
        pan: input.pan || null,
        amount: input.amount,
        currency: cfg.currency,
        message: input.message || null,
        isAnonymous: !!input.isAnonymous,
        status: "PENDING",
        gateway: cfg.gateway,
      },
    });
  });

  if (cfg.gateway === "razorpay") {
    let order;
    try {
      order = await createGatewayOrder({ amount: input.amount, receipt: donation.donationNo, notes: { donationNo: donation.donationNo, type: "donation" } });
    } catch (err) {
      console.error("[donations] gateway order failed:", err);
      await db.donation.update({ where: { id: donation.id }, data: { status: "FAILED" } }).catch(() => undefined);
      throw Errors.internal("We could not start the online payment. Please try again or contact us.");
    }
    await db.donation.update({ where: { id: donation.id }, data: { gatewayOrderId: order.orderId } });
    return {
      donation: { id: donation.id, donationNo: donation.donationNo, amount: input.amount, status: "PENDING", campaignTitle: campaign?.title ?? null },
      gateway: "razorpay",
      checkout: {
        keyId: order.keyId ?? cfg.razorpay.keyId,
        orderId: order.orderId,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        name: branding.siteName,
        description: campaign ? `Donation – ${campaign.title}` : "Donation",
        prefill: { name: input.donorName, email: input.email || undefined, contact: mobile ?? undefined },
        notes: { donationNo: donation.donationNo },
      },
      bankDetails: null,
    };
  }

  // Offline donation: the donor still has to transfer the money, so this acknowledges the pledge and
  // repeats the bank details and the reference to quote. The thank-you goes out once it is confirmed.
  if (donation.email) {
    await notify({
      email: donation.email,
      mobile: donation.mobile,
      event: "GENERIC",
      data: {
        title: `Donation ${donation.donationNo} – bank transfer details`,
        body: [
          `Dear ${donation.donorName},`,
          "",
          `Thank you for pledging ${formatINR(input.amount)} to ${branding.siteName}.`,
          "",
          `Donation number: ${donation.donationNo}`,
          campaign ? `Campaign: ${campaign.title}` : "",
          "",
          cfg.bankDetails ? `Please transfer the amount using the details below and quote your donation number as the reference.\n\n${cfg.bankDetails}` : "Our team will contact you with the transfer details.",
          "",
          "We will send your receipt as soon as the transfer is confirmed.",
          "",
          branding.siteName,
        ]
          .filter((l) => l !== "")
          .join("\n"),
      },
    });
  }
  await notifyStaff({
    permission: "donations.view",
    title: `New offline donation ${donation.donationNo}`,
    body: `${donation.donorName} pledged ${formatINR(input.amount)}${campaign ? ` to ${campaign.title}` : ""}. Awaiting bank transfer.`,
    path: `/admin/donations`,
  });

  return {
    donation: { id: donation.id, donationNo: donation.donationNo, amount: input.amount, status: "PENDING", campaignTitle: campaign?.title ?? null },
    gateway: "manual",
    checkout: null,
    bankDetails: cfg.bankDetails || null,
  };
}

/**
 * Thank-you + receipt for a donation that has actually been received. Called from the Razorpay
 * verification and when a staff member marks an offline donation completed, so a donor is thanked
 * exactly once however the money arrived.
 */
export async function notifyDonationCompleted(donationId: string) {
  const d = await db.donation.findUnique({ where: { id: donationId }, include: { campaign: { select: { title: true } } } });
  if (!d) return;
  const amount = formatINR(toNumber(d.amount));
  if (d.email) {
    await notify({
      email: d.email,
      mobile: d.mobile,
      event: "DONATION_RECEIVED",
      data: {
        name: d.donorName,
        amount,
        donationNo: d.donationNo,
        campaignLine: d.campaign ? `Campaign: ${d.campaign.title}\n` : "",
        receiptLine: d.pan ? "Your PAN has been recorded for the 80G receipt.\n" : "",
      },
    });
  }
  await notifyStaff({
    permission: "donations.view",
    title: `Donation received: ${amount}`,
    body: `${d.donorName} donated ${amount}${d.campaign ? ` to ${d.campaign.title}` : ""}. Donation number ${d.donationNo}.`,
    path: `/admin/donations`,
  });
}

export const donationVerifySchema = z.object({
  razorpay_order_id: z.string().trim().min(3).max(100),
  razorpay_payment_id: z.string().trim().min(3).max(100),
  razorpay_signature: z.string().trim().min(10).max(200),
});

/** Verifies the Razorpay checkout signature and marks the donation COMPLETED (idempotent). */
export async function verifyDonationPayment(donationId: string, input: z.infer<typeof donationVerifySchema>) {
  const donation = await db.donation.findUnique({ where: { id: donationId } });
  if (!donation) throw Errors.notFound("Donation");
  if (donation.gateway !== "razorpay") throw Errors.badRequest("This donation is not an online payment.");
  if (donation.gatewayOrderId !== input.razorpay_order_id) throw Errors.badRequest("Order mismatch.");
  const cfg = await getGatewayConfig();
  const ok = verifyRazorpayCheckoutSignature({ orderId: input.razorpay_order_id, paymentId: input.razorpay_payment_id, signature: input.razorpay_signature, secret: cfg.razorpay.keySecret });
  if (!ok) {
    await db.donation.update({ where: { id: donation.id }, data: { status: "FAILED", gatewayPaymentId: input.razorpay_payment_id } }).catch(() => undefined);
    throw Errors.badRequest("Payment signature could not be verified.");
  }
  if (donation.status === "COMPLETED") {
    return { id: donation.id, donationNo: donation.donationNo, amount: toNumber(donation.amount), status: donation.status };
  }
  let firstCompletion = false;
  const updated = await db.$transaction(async (tx) => {
    const res = await tx.donation.updateMany({ where: { id: donation.id, status: { not: "COMPLETED" } }, data: { status: "COMPLETED", gatewayPaymentId: input.razorpay_payment_id } });
    firstCompletion = res.count > 0;
    if (res.count > 0 && donation.campaignId) {
      await tx.campaign.update({ where: { id: donation.campaignId }, data: { raisedAmount: { increment: donation.amount } } });
    }
    return tx.donation.findUniqueOrThrow({ where: { id: donation.id } });
  });
  // Guarded by the same updateMany that increments the campaign total, so a retried webhook or a
  // double-submitted checkout cannot thank the donor twice.
  if (firstCompletion) await notifyDonationCompleted(updated.id);
  return { id: updated.id, donationNo: updated.donationNo, amount: toNumber(updated.amount), status: updated.status };
}

/** Active campaigns with numeric amounts for the public donate page. */
export async function listActiveCampaigns() {
  const rows = await db.campaign.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
  const now = new Date();
  return rows
    .filter((c) => !c.endDate || c.endDate >= now)
    .map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      image: c.image,
      goalAmount: c.goalAmount === null ? null : toNumber(c.goalAmount),
      raisedAmount: toNumber(c.raisedAmount),
      endDate: c.endDate,
    }));
}
