"use client";

import * as React from "react";
import { Archive, CalendarClock, FileEdit, Rocket } from "lucide-react";
import { Checkbox, Input, RadioCards } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { useHydrated } from "@/lib/hooks";
import { displayStatus, scheduledIn } from "@/lib/blog/visibility";
import { formatDate } from "@/lib/utils";
import type { BlogEditorStatus } from "@/components/admin/blog/types";

/**
 * Publishing control: Draft / Publish now / Schedule, plus Archive for a post that already exists.
 *
 * It writes exactly two values — `status` and `publishedAt` — because those two columns ARE the
 * scheduling mechanism. There is no `SCHEDULED` value in `ContentStatus` (that enum is shared with
 * Events, CMS pages, Programmes, Stories and Campaigns): a post is live iff it is `PUBLISHED` and
 * its `publishedAt` has passed, and every public query goes through `livePostWhere()`. Nothing
 * flips a status when the clock passes and there is no cron — the post simply starts matching.
 *
 * The previous UI was a bare status `<Select>` beside a `datetime-local` input, which made the
 * single most consequential decision on the screen ("is this visible to the public?") look like
 * two unrelated fields. Here the three outcomes are three cards with the consequence written on
 * them, and a live readout underneath says what will actually happen when Save is pressed.
 *
 * Archive is a separate control rather than a fourth card because it is a different question:
 * the first three ask "when does this go live?", archiving asks "take this down". It only appears
 * for a saved post — nobody creates an archive.
 */

export type ScheduleMode = "draft" | "now" | "schedule";

export interface ScheduleFieldProps {
  status: BlogEditorStatus;
  /** `datetime-local` string in the browser's local time, or "". */
  publishedAt: string;
  onChange: (next: { status: BlogEditorStatus; publishedAt: string }) => void;
  /** `cms.publish`. Without it every control is read-only and the reason is spelled out. */
  canPublish: boolean;
  /** Saving / read-only form. */
  disabled?: boolean;
  /** Validation error for the date input. */
  error?: string;
  /** Show the Archive option. The editor passes `true` only for a record that already exists. */
  showArchive?: boolean;
  /** Id of the date input, so the form's ErrorSummary can jump to it. */
  inputId?: string;
}

/** Date → `<input type="datetime-local">` value, in local time (same shape as `toDateTimeLocal`). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Next full hour, which is always at least ~55 minutes ahead — a sane default for "schedule this". */
function defaultScheduleAt(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
}

function initialMode(status: BlogEditorStatus, publishedAt: string): ScheduleMode {
  if (status === "PUBLISHED") return publishedAt ? "schedule" : "now";
  if (status === "DRAFT") return "draft";
  // ARCHIVED: remember what un-archiving should restore.
  return publishedAt ? "schedule" : "draft";
}

/**
 * The sentence under the cards. Computed against `Date.now()`, so it is rendered only once the
 * component has hydrated — a client component is server-rendered first, and "Goes live in 59
 * minutes" measured on the server would not match the same sentence measured a moment later in
 * the browser.
 */
function describe(status: BlogEditorStatus, publishedAt: string): string {
  if (status === "ARCHIVED") return "Archived. It is hidden from the website but nothing is deleted.";
  if (status === "DRAFT") return publishedAt ? "Draft. Only the team can see it — the date below is kept for when you publish." : "Draft. Only the team can see it.";
  if (!publishedAt) return "Goes live the moment you save, stamped with that time.";
  const state = displayStatus({ status, publishedAt });
  if (state === "SCHEDULED") return `${scheduledIn({ status, publishedAt })} (${formatDate(publishedAt, "EEE, d MMM yyyy, h:mm a")}).`;
  return `Live since ${formatDate(publishedAt, "d MMM yyyy, h:mm a")}.`;
}

const MODE_OPTIONS = [
  { value: "draft", label: "Draft", description: "Only the team can see it", icon: <FileEdit className="h-5 w-5" /> },
  { value: "now", label: "Publish now", description: "Live as soon as you save", icon: <Rocket className="h-5 w-5" /> },
  { value: "schedule", label: "Schedule", description: "Goes live automatically at the time you pick", icon: <CalendarClock className="h-5 w-5" /> },
];

export function ScheduleField({ status, publishedAt, onChange, canPublish, disabled, error, showArchive, inputId = "blog-publish-at" }: ScheduleFieldProps) {
  const [mode, setMode] = React.useState<ScheduleMode>(() => initialMode(status, publishedAt));
  const archived = status === "ARCHIVED";
  const locked = disabled || !canPublish;

  // Derived, not stored: the sentence is a pure function of the two values above plus the clock,
  // and `useHydrated` keeps the server's clock out of it.
  const hydrated = useHydrated();
  const readout = hydrated ? describe(status, publishedAt) : null;

  const apply = (next: ScheduleMode) => {
    setMode(next);
    if (next === "draft") {
      // The date is kept, not cleared: an author who flips a scheduled post back to draft to fix a
      // typo should not have to re-pick the time. `blogData()` only honours it for PUBLISHED.
      onChange({ status: "DRAFT", publishedAt });
    } else if (next === "now") {
      onChange({ status: "PUBLISHED", publishedAt: "" });
    } else {
      onChange({ status: "PUBLISHED", publishedAt: publishedAt || defaultScheduleAt() });
    }
  };

  return (
    <div className="space-y-4">
      {/* `autoWire={false}`: RadioCards is a composite `role="radiogroup"`, not a single control, so
          Field must not try to hang an id / aria-describedby off it. Same call shape as the other
          RadioCards call sites in the admin. */}
      <Field label="Publishing" autoWire={false} hint={canPublish ? undefined : "Changing the status requires the Publish Website Content permission."}>
        <RadioCards
          name="blog-publish-mode"
          value={archived ? undefined : mode}
          onChange={(v) => apply(v as ScheduleMode)}
          columns={1}
          options={MODE_OPTIONS.map((o) => ({ ...o, disabled: locked || archived }))}
        />
      </Field>

      {mode === "schedule" && !archived && (
        <Field
          label="Goes live at"
          htmlFor={inputId}
          error={error}
          hint="This is the time on this device, not the server's. A time in the past means the post is live immediately."
        >
          <Input
            id={inputId}
            type="datetime-local"
            value={publishedAt}
            onChange={(e) => onChange({ status: "PUBLISHED", publishedAt: e.target.value })}
            invalid={!!error}
            disabled={locked}
          />
        </Field>
      )}

      {showArchive && (
        <Checkbox
          checked={archived}
          onChange={(e) => (e.target.checked ? onChange({ status: "ARCHIVED", publishedAt }) : apply(mode))}
          disabled={locked}
          label={
            <span className="inline-flex items-center gap-1.5">
              <Archive className="h-4 w-4 text-muted" aria-hidden /> Archive this post
            </span>
          }
          description="Takes it off the website and out of the feed, and keeps everything you wrote. Untick to put it back."
        />
      )}

      {readout && (
        <p role="status" aria-live="polite" className="rounded-md border border-line bg-surface/70 px-3 py-2 text-body-sm text-ink">
          {readout}
        </p>
      )}
    </div>
  );
}
