import * as React from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { KeyValue } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/site/markdown";

/**
 * One Terms & Conditions acceptance on an admin application page: when it was accepted, which
 * version, the declaration filled in from the application, and the exact text the applicant
 * accepted (kept in `TermsVersion`, so later edits to the CMS page never change it).
 */
export function AcceptedTerms({
  acceptedAt,
  terms,
  declaration,
  missing,
}: {
  acceptedAt: Date | null;
  terms: { version: string; title: string; content: string } | null;
  /** The filled declaration (`<CentreDeclaration …/>` and the like). */
  declaration: React.ReactNode;
  /** Shown instead when nothing was accepted. */
  missing: React.ReactNode;
}) {
  if (!acceptedAt) return <>{missing}</>;
  // Distinct texts have distinct versions, so this is unique on a page that shows two acceptances.
  const titleId = terms ? `accepted-terms-${terms.version}` : undefined;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
        <KeyValue
          label="Status"
          value={
            <Badge tone="success">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Accepted
            </Badge>
          }
        />
        <KeyValue label="Accepted on" value={formatDateTime(acceptedAt)} />
        <KeyValue label="Version" value={<span className="font-mono">{terms?.version ?? "—"}</span>} />
      </div>
      {declaration}
      {terms && (
        <details className="group rounded-card border border-line">
          <summary className="ring-focus flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-4 py-2 text-body-sm font-semibold text-navy [&::-webkit-details-marker]:hidden">
            Read the exact text the applicant accepted
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-micro group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
          </summary>
          {/* Focusable so the box can be scrolled from the keyboard (the text has no links to land on). */}
          <div tabIndex={0} role="region" aria-labelledby={titleId} className="ring-focus-inset relative max-h-[28rem] overflow-y-auto border-t border-line px-4 py-4">
            <h3 id={titleId} className="mb-3 text-h4 text-navy">
              {terms.title}
            </h3>
            <Markdown source={terms.content} anchors={false} />
          </div>
        </details>
      )}
    </div>
  );
}
