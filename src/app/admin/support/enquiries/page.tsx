import { MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber, titleCase } from "@/lib/utils";
import { enquiryListSchema, listEnquiries } from "@/server/support";
import { EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { EnquiryTable } from "@/components/admin/support/enquiry-table";
import { Pager } from "@/components/admin/pickers/pager";
import { flattenSearchParams, parseListQuery, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Enquiries" };

const STATUS_TABS = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const TYPES = ["GENERAL", "ADMISSION", "VOLUNTEER", "PARTNERSHIP", "DONATION", "OTHER"] as const;

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("support.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(enquiryListSchema, sp);
  const [data, counts] = await Promise.all([listEnquiries(q), db.enquiry.groupBy({ by: ["status"], _count: { _all: true } })]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const all = counts.reduce((n, c) => n + c._count._all, 0);
  const base = "/admin/support/enquiries";

  return (
    <AdminListPage
      header={{ title: "Website enquiries", mobileTitle: "Enquiries", description: `${formatNumber(data.meta.total)} enquir${data.meta.total === 1 ? "y" : "ies"} in the current view, received from the Contact page.` }}
      tabs={all === 0 ? undefined : <QueryTabs param="status" keep={["type", "q"]} items={[{ value: "", label: "All", count: all }, ...STATUS_TABS.map((s) => ({ value: s, label: titleCase(s), count: countOf(s) }))]} />}
      filters={
        all === 0 ? undefined : (
          <FilterBar
            preserve={["status"]}
            fields={[
              { type: "search", placeholder: "Name, email, mobile or subject" },
              { type: "select", name: "type", label: "Type", options: TYPES.map((t) => ({ value: t, label: titleCase(t) })) },
            ]}
          />
        )
      }
      pagination={all === 0 ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
    >
      {all === 0 ? <EmptyState icon={<MessageSquare className="h-7 w-7" />} title="No enquiries yet" description="Messages sent through the website Contact form appear here, ready to answer by email or SMS." /> : <EnquiryTable items={data.items} canRespond={hasPermission(user, "support.respond")} />}
    </AdminListPage>
  );
}
