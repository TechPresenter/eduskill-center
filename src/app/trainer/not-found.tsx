import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { SetMobileHeader } from "@/components/portal/header-context";

export const metadata: Metadata = { title: "Not found", robots: { index: false, follow: false } };

/** 404 inside the trainer portal (e.g. a batch no longer assigned to you): keeps the app shell, offers a way back. */
export default function TrainerNotFound() {
  return (
    <>
      <SetMobileHeader title="Not found" backHref="/trainer/dashboard" />
      <h1 className="sr-only">Page not found</h1>
      <EmptyState
        icon={<Compass className="h-7 w-7" />}
        title="We could not find that page"
        description="The link may be out of date, or the batch may no longer be assigned to you. Your home screen has everything you teach."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <ButtonLink href="/trainer/dashboard">Back to home</ButtonLink>
            <ButtonLink href="/trainer/batches" variant="outline">
              My batches
            </ButtonLink>
          </div>
        }
      />
    </>
  );
}
