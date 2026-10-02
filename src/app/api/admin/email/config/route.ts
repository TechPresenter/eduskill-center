import { apiHandler } from "@/lib/api/handler";
import { composerConfig } from "@/server/email";

/**
 * The composer's defaults: whether SMTP is configured, the From / Reply-To line, the signature and
 * the limits (recipients, attachment size, daily cap). Never carries SMTP credentials.
 */
export const GET = apiHandler({ permission: "email.send" }, async () => composerConfig());
