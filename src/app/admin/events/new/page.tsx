import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/ui/misc";
import { ContentEditor } from "@/components/admin/content/content-editor";
import { eventFields } from "../fields";

export const metadata = { title: "New Event" };

export default async function NewEventPage() {
  const user = await requireAdmin("cms.update");
  const canPublish = hasPermission(user, "cms.publish");
  return (
    <div>
      <PageHeader breadcrumbs={[{ label: "Events", href: "/admin/events" }, { label: "New event" }]} title="New event" description="Save as a draft first, then publish when the details are final." />
      <ContentEditor
        endpoint="/api/admin/events"
        itemLabel="event"
        backHref="/admin/events"
        canEdit
        fields={eventFields({ canPublish })}
        initial={{ title: "", slug: "", startAt: "", endAt: "", status: "DRAFT", registrationUrl: "", location: "", stateId: "", districtId: "", blockId: "", summary: "", image: "", content: "" }}
      />
    </div>
  );
}
