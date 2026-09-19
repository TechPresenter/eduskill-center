import { z } from "zod";
import { db } from "@/lib/db";
import { emailSchema, mobileSchema } from "@/lib/validation/common";
import { notify, notifyStaff } from "@/lib/notifications";

export const enquiryTypes = ["GENERAL", "ADMISSION", "VOLUNTEER", "PARTNERSHIP", "DONATION", "OTHER"] as const;

export const enquiryInputSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.union([z.literal(""), emailSchema]).optional(),
  mobile: mobileSchema,
  type: z.enum(enquiryTypes).default("GENERAL"),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(10, "Please write a few more words").max(3000),
  /** Honeypot – must stay empty. Bots that fill it are silently accepted but not stored. */
  website: z.string().max(200).optional(),
});

export type EnquiryInput = z.infer<typeof enquiryInputSchema>;

/** Creates a public enquiry (contact form). Returns a null id when the honeypot was triggered. */
export async function createEnquiry(input: EnquiryInput, meta: { ip?: string | null } = {}) {
  if (input.website && input.website.trim().length > 0) return { id: null, spam: true as const };
  const mobile = input.mobile.replace(/[\s-]/g, "").replace(/^\+?91/, "");
  const enquiry = await db.enquiry.create({
    data: {
      name: input.name,
      email: input.email ? input.email.toLowerCase() : null,
      mobile,
      type: input.type,
      subject: input.subject || null,
      message: input.message,
      ip: meta.ip ?? null,
    },
    select: { id: true, createdAt: true },
  });
  if (input.email) {
    await notify({
      email: input.email.toLowerCase(),
      mobile,
      event: "ENQUIRY_RECEIVED",
      data: { name: input.name, message: input.message },
    });
  }
  await notifyStaff({
    permission: "support.view",
    title: `New ${input.type.toLowerCase()} enquiry from ${input.name}`,
    body: `${input.subject ? `Subject: ${input.subject}\n\n` : ""}${input.message}\n\nMobile: ${mobile}${input.email ? `\nEmail: ${input.email}` : ""}`,
    path: "/admin/support/enquiries",
  });
  return { id: enquiry.id, spam: false as const };
}
