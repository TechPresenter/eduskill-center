import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { batchFormOptions } from "@/app/admin/batches/queries";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { BatchForm } from "@/components/admin/batches/batch-form";
import { flattenParams, type SearchParamsRecord } from "@/components/admin/shared/url";

export const metadata: Metadata = { title: "New Batch · Foundation Admin" };

export default async function NewBatchPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireAdmin("batches.create");
  const sp = flattenParams(await searchParams);
  const options = await batchFormOptions();
  const lock = sp.centerId && options.centers.some((c) => c.id === sp.centerId) ? sp.centerId : undefined;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Create a batch" description="A batch is one course running at one center with a schedule, a seat capacity and (optionally) a trainer." breadcrumbs={[{ label: "Batches", href: "/admin/batches" }, { label: "New" }]} />
      {options.centers.length === 0 && <Alert tone="warning" className="mb-4">No active or pending training centers exist yet. Add a center first.</Alert>}
      <Card>
        <CardBody>
          <BatchForm options={options} lockCenterId={lock} />
        </CardBody>
      </Card>
    </div>
  );
}
