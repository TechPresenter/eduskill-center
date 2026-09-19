import { Alert } from "@/components/ui/feedback";

/** Shown on every trainer page when the trainer record is not ACTIVE; actions are disabled by the pages. */
export function InactiveBanner({ status }: { status: string }) {
  if (status === "ACTIVE") return null;
  return (
    <Alert tone="warning" title="Your trainer account is inactive" className="mb-6">
      You can view your records, but marking attendance, coursework and announcements are disabled. Please contact the Foundation office to reactivate your account.
    </Alert>
  );
}
