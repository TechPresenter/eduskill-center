import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api/errors";
import { getPaymentSummary } from "@/server/payments";
import { getBranding } from "@/lib/settings";
import { isUuid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { PayForm } from "@/components/student/pay-form";

export const metadata: Metadata = { title: "Pay Fee" };

export default async function StudentPayPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await requireStudent();
  const { applicationId } = await params;
  if (!isUuid(applicationId)) notFound();

  let summary: Awaited<ReturnType<typeof getPaymentSummary>> | null = null;
  let notReady: string | null = null;
  try {
    summary = await getPaymentSummary(applicationId, user.student.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    if (err instanceof ApiError && err.status === 400) notReady = err.message;
    else throw err;
  }
  const branding = await getBranding();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Fees & Payments", href: "/student/payments" }, { label: summary?.applicationNo ?? "Pay" }]}
        title="Pay fee"
        mobileTitle="Pay fee"
        backHref={`/student/applications/${applicationId}`}
        description={summary ? `${summary.course} · Application ${summary.applicationNo}` : undefined}
      />
      {notReady || !summary ? (
        <Alert tone="warning" title="Payment not available yet" action={<ButtonLink href={`/student/applications/${applicationId}`} size="md" variant="navy">View application</ButtonLink>}>
          {notReady ?? "This application is not ready for payment."} Fees can be paid once the Foundation approves your application.
        </Alert>
      ) : (
        <PayForm summary={summary} contact={{ email: branding.contact.email, phone: branding.contact.phone }} />
      )}
    </div>
  );
}
