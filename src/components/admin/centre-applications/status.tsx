import { titleCase } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/badge";

/**
 * Status vocabulary for centre (Shiksha Mission) applications. Kept here because the shared
 * `StatusBadge` map has no entry for the Shiksha-specific statuses; safe in server and client
 * components (pure presentation, no server imports).
 */
const TONES: Record<string, BadgeTone> = {
  SUBMITTED: "info",
  UNDER_REVIEW: "info",
  DOCUMENTS_REQUIRED: "warning",
  DOCUMENTS_VERIFIED: "success",
  CENTRE_VERIFICATION: "info",
  SELECTED: "navy",
  AGREEMENT_PENDING: "warning",
  AGREEMENT_SIGNED: "navy",
  ORIENTATION: "orange",
  APPROVED: "success",
  REJECTED: "danger",
};

const LABELS: Record<string, string> = {
  DOCUMENTS_REQUIRED: "Documents Required",
  DOCUMENTS_VERIFIED: "Documents Verified",
  CENTRE_VERIFICATION: "Centre Verification",
  AGREEMENT_PENDING: "Agreement Pending",
  AGREEMENT_SIGNED: "Agreement Signed",
};

export function centreStatusLabel(status: string) {
  return LABELS[status] ?? titleCase(status);
}

export function CentreStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={TONES[status] ?? "neutral"} dot className={className}>
      {centreStatusLabel(status)}
    </Badge>
  );
}

/** "Step 3 of 7" pill; step 0 (rejected) renders nothing. */
export function StepPill({ step, className }: { step: number; className?: string }) {
  if (!step) return null;
  return (
    <Badge tone="neutral" className={className}>
      Step {step} of 7
    </Badge>
  );
}
