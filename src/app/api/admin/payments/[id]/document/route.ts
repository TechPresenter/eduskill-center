import { apiHandler } from "@/lib/api/handler";
import { renderPaymentDocument } from "@/server/receipts";

/** Receipt (completed payments) or proforma invoice (pending) as PDF. */
export const GET = apiHandler<{ id: string }>({ permission: "payments.view" }, async ({ params, req }) => {
  const { buffer, filename } = await renderPaymentDocument(params.id);
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
