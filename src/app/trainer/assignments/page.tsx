import type { Metadata } from "next";
import Link from "next/link";
import { Building2, MapPin, Phone } from "lucide-react";
import { requireTrainer } from "@/lib/auth/guards";
import { formatDate } from "@/lib/utils";
import { myAssignments } from "@/server/trainer-scope";
import { PageHeader, KeyValue } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { InactiveBanner } from "@/components/trainer/inactive-banner";

export const metadata: Metadata = { title: "My Assignments" };

type Assignment = Awaited<ReturnType<typeof myAssignments>>["active"][number];

function AssignmentCard({ a }: { a: Assignment }) {
  const address = [a.center.address, a.center.villageTown, a.center.district.name, a.center.state.name, a.center.pincode].filter(Boolean).join(", ");
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-navy-soft text-navy">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-h4 text-navy">{a.center.name}</p>
              <p className="font-mono text-caption font-medium text-muted">{a.center.code}</p>
              <p className="mt-2 flex items-start gap-1.5 text-body-sm text-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {address}
              </p>
              {a.center.phone && (
                <a href={`tel:${a.center.phone}`} className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-navy hover:underline">
                  <Phone className="h-4 w-4 shrink-0" aria-hidden /> {a.center.phone}
                </a>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {a.isActive ? (
              <Badge tone="success" dot>
                Active
              </Badge>
            ) : (
              <Badge tone="neutral">Ended</Badge>
            )}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
          <KeyValue label="Course" value={a.course ? `${a.course.name} (${a.course.code})` : "Any course at this center"} />
          <KeyValue
            label="Batch"
            value={
              a.batch ? (
                <Link href={`/trainer/batches/${a.batch.id}`} className="inline-flex flex-wrap items-center gap-1.5 text-navy hover:underline">
                  {a.batch.name} <StatusBadge status={a.batch.status} />
                </Link>
              ) : (
                "Center-level"
              )
            }
          />
          <KeyValue label="Since" value={formatDate(a.assignedAt)} />
          <KeyValue label={a.isActive ? "Status" : "Ended"} value={a.isActive ? "Ongoing" : formatDate(a.endedAt)} />
        </div>
        {a.notes && <p className="mt-4 rounded-lg bg-surface p-3 text-body-sm text-muted">{a.notes}</p>}
      </CardBody>
    </Card>
  );
}

export default async function TrainerAssignmentsPage() {
  const user = await requireTrainer();
  const { active, past } = await myAssignments(user.trainer.id);
  return (
    <>
      <PageHeader title="My Assignments" description="Training centers, courses and batches assigned to you by the Foundation." />
      <InactiveBanner status={user.trainer.status} />
      <section className="space-y-3">
        <h2 className="text-overline text-muted">Active ({active.length})</h2>
        {active.length === 0 ? (
          <EmptyState icon={<Building2 className="h-7 w-7" />} title="No active assignments" description="You will see your center and batch here once the Foundation assigns you." />
        ) : (
          active.map((a) => <AssignmentCard key={a.id} a={a} />)
        )}
      </section>
      {past.length > 0 && (
        <section className="mt-8 space-y-3">
          <h2 className="text-overline text-muted">Past ({past.length})</h2>
          <Card>
            <CardHeader title="Assignment history" />
            <CardBody className="p-0">
              <ul className="divide-y divide-line">
                {past.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-ink">
                        {a.center.name} <span className="font-mono text-caption font-normal text-muted">({a.center.code})</span>
                      </p>
                      <p className="text-caption text-muted">
                        {a.course ? a.course.name : "Any course"}
                        {a.batch ? ` · ${a.batch.name}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-caption text-muted">
                      {formatDate(a.assignedAt)} – {formatDate(a.endedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </section>
      )}
    </>
  );
}
