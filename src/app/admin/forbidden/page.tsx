import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { SetMobileHeader } from "@/components/portal/header-context";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto w-full max-w-xl py-6 lg:py-10">
      <SetMobileHeader title="No access" />
      <EmptyState
        icon={<ShieldAlert className="h-7 w-7" />}
        title="You don't have permission for this area"
        description="Your Foundation Staff role does not include this module. Ask the Super Admin to grant the required permission."
        action={
          <ButtonLink href="/admin/dashboard" variant="navy" size="md" fullWidth className="sm:w-auto">
            Back to dashboard
          </ButtonLink>
        }
      />
    </div>
  );
}
