import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { getCertificatePdf } from "@/server/certificates";

/** GET /api/student/certificates/[id]/download – the student's own certificate as PDF. */
export const GET = apiHandler<{ id: string }>({ roles: ["STUDENT"] }, async ({ params, user }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Certificate");
  const { buffer, filename } = await getCertificatePdf(params.id, { studentId: user!.student!.id });
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
