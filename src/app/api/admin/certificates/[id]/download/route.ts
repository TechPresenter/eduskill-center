import { apiHandler } from "@/lib/api/handler";
import { getCertificatePdf } from "@/server/certificates";

/** Certificate PDF (rendered on demand when the stored copy is missing). */
export const GET = apiHandler<{ id: string }>({ permission: "certificates.view" }, async ({ params, req }) => {
  const { buffer, filename } = await getCertificatePdf(params.id);
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
