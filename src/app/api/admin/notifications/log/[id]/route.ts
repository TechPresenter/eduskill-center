import { apiHandler } from "@/lib/api/handler";
import { getSentNotification, resendNotification } from "@/server/notifications-admin";

export const GET = apiHandler<{ id: string }>({ permission: "notifications.view" }, async ({ params }) => getSentNotification(params.id));

/** Resend a FAILED email/SMS/WhatsApp notification to the same recipient. */
export const POST = apiHandler<{ id: string }>({ permission: "notifications.send" }, async ({ params, user, ip, userAgent }) => resendNotification(params.id, { user: user!, ip, userAgent }));
