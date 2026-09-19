import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { ContentEditor } from "@/components/admin/content/content-editor";
import { toDateTimeLocal } from "@/components/admin/content/fields";
import { eventFields } from "../fields";

export const metadata = { title: "Edit Event" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("cms.view");
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) notFound();
  const canEdit = hasPermission(user, "cms.update");
  const canPublish = hasPermission(user, "cms.publish");

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Events", href: "/admin/events" }, { label: event.title }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {event.title}
            <StatusBadge status={event.status} />
          </span>
        }
        description={
          <span>
            <span className="font-mono">/events/{event.slug}</span> · {formatDateTime(event.startAt)}
          </span>
        }
      />
      <ContentEditor
        endpoint="/api/admin/events"
        id={event.id}
        itemLabel="event"
        backHref="/admin/events"
        canEdit={canEdit}
        viewHref={event.status === "PUBLISHED" ? `/events/${event.slug}` : null}
        fields={eventFields({ canPublish })}
        initial={{
          title: event.title,
          slug: event.slug,
          startAt: toDateTimeLocal(event.startAt),
          endAt: toDateTimeLocal(event.endAt),
          status: event.status,
          registrationUrl: event.registrationUrl ?? "",
          location: event.location ?? "",
          stateId: event.stateId ?? "",
          districtId: event.districtId ?? "",
          blockId: "",
          summary: event.summary ?? "",
          image: event.image ?? "",
          content: event.content ?? "",
        }}
        meta={`Last saved ${formatDateTime(event.updatedAt)}`}
      />
    </div>
  );
}
