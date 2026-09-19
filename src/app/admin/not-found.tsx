import { FileQuestion } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { SetMobileHeader } from "@/components/portal/header-context";

/** Shown by `notFound()` from any admin page (missing record, unknown settings group, bad URL). */
export default function AdminNotFound() {
  return (
    <div className="mx-auto w-full max-w-xl py-6 lg:py-10">
      <SetMobileHeader title="Not found" />
      <EmptyState
        icon={<FileQuestion className="h-7 w-7" />}
        title="We couldn't find that record"
        description="The page or record you opened no longer exists, or the link is incorrect. Check the list to find the current record."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <ButtonLink href="/admin/dashboard" variant="navy" size="md" fullWidth className="sm:w-auto">
              Back to dashboard
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
