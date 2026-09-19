import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { SetMobileHeader } from "@/components/portal/header-context";

export const metadata: Metadata = { title: "Not found", robots: { index: false, follow: false } };

/** 404 inside the student portal: keeps the app shell, offers a way back. */
export default function StudentNotFound() {
  return (
    <>
      <SetMobileHeader title="Not found" backHref="/student/dashboard" />
      <h1 className="sr-only">Page not found</h1>
      <EmptyState
        icon={<Compass className="h-7 w-7" />}
        title="We could not find that page"
        description="The link may be out of date, or the record may have been removed. Your dashboard has everything you need."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <ButtonLink href="/student/dashboard">Back to dashboard</ButtonLink>
            <ButtonLink href="/student/support" variant="outline">
              Contact support
            </ButtonLink>
          </div>
        }
      />
    </>
  );
}
