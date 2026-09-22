import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/feedback";

/**
 * Shown on every trainer page when the trainer record is not ACTIVE; the pages disable the actions.
 * On the phone home the trainer card already carries the same warning, so that page passes
 * `className="hidden lg:block"` rather than saying it twice.
 */
export function InactiveBanner({ status, className }: { status: string; className?: string }) {
  if (status === "ACTIVE") return null;
  return (
    <Alert tone="warning" title="Your trainer account is inactive" className={cn("mb-6", className)}>
      You can view your records, but marking attendance, coursework and announcements are disabled. Please contact the Foundation office to reactivate your account.
    </Alert>
  );
}
