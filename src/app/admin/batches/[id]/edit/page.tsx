import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { dateInputValue } from "@/lib/utils";
import { batchFormOptions, getBatchAdmin } from "@/app/admin/batches/queries";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { BatchForm } from "@/components/admin/batches/batch-form";
import { orNotFound } from "@/components/admin/shared/server";

export const metadata: Metadata = { title: "Edit Batch · Foundation Admin" };

export default async function EditBatchPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("batches.update");
  const { id } = await params;
  const [batch, options] = await Promise.all([orNotFound(getBatchAdmin(id)), batchFormOptions()]);
  const centers = options.centers.some((c) => c.id === batch.centerId) ? options.centers : [...options.centers, { id: batch.center.id, code: batch.center.code, name: batch.center.name, state: batch.center.state.name, courses: [{ id: batch.course.id, name: batch.course.name, code: batch.course.code, status: "ACTIVE" }] }];
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Edit ${batch.name}`} description={<span className="font-mono">{batch.code}</span>} breadcrumbs={[{ label: "Batches", href: "/admin/batches" }, { label: batch.code, href: `/admin/batches/${batch.id}` }, { label: "Edit" }]} />
      {batch.status === "COMPLETED" && <Alert tone="info" className="mb-4">This batch is completed. Schedule details can still be corrected, but its status cannot change.</Alert>}
      <Card>
        <CardBody>
          <BatchForm
            options={{ ...options, centers }}
            initial={{
              id: batch.id,
              name: batch.name,
              centerId: batch.centerId,
              courseId: batch.courseId,
              trainerId: batch.trainerId,
              startDate: dateInputValue(batch.startDate),
              endDate: dateInputValue(batch.endDate),
              startTime: batch.startTime,
              endTime: batch.endTime,
              days: batch.days,
              capacity: batch.capacity,
              room: batch.room,
              status: batch.status,
              notes: batch.notes,
              occupied: batch.seats.occupied,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
