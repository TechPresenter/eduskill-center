import type { FieldDef } from "@/components/admin/content/fields";

export const EVENT_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft (hidden)" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived (hidden)" },
];

/** Form definition shared by the create and edit pages. */
export function eventFields(opts: { canPublish: boolean }): FieldDef[] {
  return [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "slug", label: "URL slug", type: "slug", from: "title", hint: "Public address: /events/<slug>" },
    { key: "startAt", label: "Starts", type: "datetime", required: true },
    { key: "endAt", label: "Ends", type: "datetime", hint: "Optional. Must be after the start." },
    { key: "status", label: "Status", type: "select", options: EVENT_STATUS_OPTIONS, disabled: !opts.canPublish, hint: opts.canPublish ? undefined : "Changing the status requires the Publish Website Content permission." },
    { key: "registrationUrl", label: "Registration link", type: "url", placeholder: "https://forms.example.org/…" },
    { key: "location", label: "Venue / location", type: "text", placeholder: "e.g. EduSkill Center, Varanasi" },
    { key: "stateId", label: "State & district", type: "location", depth: "district", hint: "Used to show the event in the right region." },
    { key: "summary", label: "Summary", type: "textarea", rows: 2, hint: "Shown on the events listing." },
    { key: "image", label: "Banner image", type: "image", folder: "events" },
    { key: "content", label: "Details", type: "textarea", markdown: true, rows: 14 },
  ];
}
