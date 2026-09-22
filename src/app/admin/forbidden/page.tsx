import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { SetMobileHeader } from "@/components/portal/header-context";

/** Where `requireAdmin(permission)` sends staff whose role does not include the module they opened. */
export default function ForbiddenPage() {
  return (
    <div className="mx-auto w-full max-w-xl py-10 lg:py-16">
      <SetMobileHeader title="No access" />
      <EmptyState
        icon={<ShieldAlert className="h-7 w-7" />}
        title="You don't have permission for this area"
        description="Your Foundation Staff role does not include this module. Ask the Super Admin to grant the required permission, then open the page again."
        action={
          <ButtonLink href="/admin/dashboard" variant="navy" size="md" fullWidth className="sm:w-auto">
            Back to dashboard
          </ButtonLink>
        }
      />
    </div>
  );
}
