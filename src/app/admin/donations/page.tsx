import { HandCoins } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatINR, formatNumber, titleCase } from "@/lib/utils";
import { donationListSchema, listCampaigns, listDonations } from "@/server/donations-admin";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { StatsCard } from "@/components/ui/stats";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { ExportButton } from "@/components/admin/pickers/export-button";
import { Pager } from "@/components/admin/content/pager";
import { CampaignManager } from "@/components/admin/donations/campaign-manager";
import { DonationActions } from "@/components/admin/donations/donation-actions";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Donations" };

export default async function DonationsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("donations.view");
  const sp = flattenSearchParams(await searchParams);
  const tab = sp.tab === "donations" ? "donations" : "campaigns";
  const canUpdate = hasPermission(user, "donations.update");
  const base = "/admin/donations";
  const campaigns = await listCampaigns();
  const q = parseListQuery(donationListSchema, sp);
  const data = tab === "donations" ? await listDonations(q) : null;
  const totalRaised = campaigns.reduce((n, c) => n + c.raisedAmount, 0);

  return (
    <div>
      <PageHeader
        title="Donations"
        mobileTitle="Donations"
        description="Fund-raising campaigns and the donations received against them."
        actions={tab === "donations" ? <ExportButton href={withParams("/api/admin/donations/export", sp, { page: undefined, limit: undefined, tab: undefined })} label="Export CSV" /> : undefined}
      />

      <QueryTabs
        param="tab"
        defaultValue="campaigns"
        className="mb-4"
        items={[
          { value: "campaigns", label: "Campaigns", count: campaigns.length },
          { value: "donations", label: "Donations" },
        ]}
      />

      {tab === "campaigns" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatsCard label="Active campaigns" value={campaigns.filter((c) => c.isActive).length} tone="success" />
            <StatsCard label="Raised across campaigns" value={formatINR(totalRaised)} tone="orange" hint="Completed donations only" />
            <StatsCard label="Completed donations" value={campaigns.reduce((n, c) => n + c.completedCount, 0)} tone="navy" />
          </div>
          <CampaignManager items={campaigns} canEdit={canUpdate} />
        </div>
      )}

      {tab === "donations" && data && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatsCard label="Donations in view" value={data.meta.total} tone="navy" />
            <StatsCard label="Completed amount" value={formatINR(data.completedAmount)} tone="success" hint={`${formatNumber(data.completedCount)} completed`} />
            <StatsCard label="Pending (manual)" value={data.items.filter((d) => d.status === "PENDING" && d.gateway === "manual").length} tone="warning" hint="On this page" />
          </div>

          <FilterBar
            preserve={["tab"]}
            fields={[
              { type: "search", placeholder: "Donation no, donor, email, mobile or payment id" },
              { type: "select", name: "status", label: "Status", options: ["PENDING", "COMPLETED", "FAILED"].map((s) => ({ value: s, label: titleCase(s) })) },
              { type: "select", name: "campaignId", label: "Campaign", options: campaigns.map((c) => ({ value: c.id, label: c.title })), placeholder: "All campaigns" },
              {
                type: "select",
                name: "gateway",
                label: "Gateway",
                options: [
                  { value: "manual", label: "Manual / offline" },
                  { value: "razorpay", label: "Razorpay" },
                ],
              },
              { type: "date-range", label: "Received between" },
            ]}
          />

          {data.meta.total === 0 && !Object.keys(sp).some((k) => k !== "tab" && k !== "page") ? (
            <EmptyState icon={<HandCoins className="h-7 w-7" />} title="No donations yet" description="Donations made through the website appear here." />
          ) : (
            <>
              <TableWrap>
                <THead>
                  <tr>
                    <TH>Donation</TH>
                    <TH>Donor</TH>
                    <TH>Campaign</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Gateway</TH>
                    <TH>Status</TH>
                    <TH>Received</TH>
                    <TH>Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {data.items.length === 0 && <EmptyRow colSpan={8}>No donations match these filters.</EmptyRow>}
                  {data.items.map((d) => (
                    <TR key={d.id}>
                      <TD label="Donation" mobile="hidden">
                        <span className="font-mono text-xs font-semibold text-navy">{d.donationNo}</span>
                        {d.gatewayPaymentId && <span className="block max-w-[10rem] truncate text-xs text-muted">{d.gatewayPaymentId}</span>}
                      </TD>
                      <TD mobile="full">
                        <span className="block font-mono text-xs font-semibold text-orange md:hidden">{d.donationNo}</span>
                        <span className="block font-medium">{d.donorDisplay}</span>
                        {!d.isAnonymous && <span className="block text-xs font-normal text-muted">{[d.email, d.mobile].filter(Boolean).join(" · ") || "—"}</span>}
                        {d.pan && !d.isAnonymous && <span className="block text-xs font-normal text-muted">PAN {d.pan}</span>}
                      </TD>
                      <TD label="Campaign">{d.campaign?.title ?? <span className="text-xs text-muted">General fund</span>}</TD>
                      <TD label="Amount" className="text-right font-semibold tabular-nums max-md:text-base max-md:text-navy">
                        {formatINR(d.amount)}
                      </TD>
                      <TD label="Gateway">
                        <Badge tone={d.gateway === "manual" ? "neutral" : "info"}>{titleCase(d.gateway)}</Badge>
                      </TD>
                      <TD label="Status">
                        <StatusBadge status={d.status} />
                      </TD>
                      <TD label="Received" className="text-muted md:whitespace-nowrap">
                        {formatDateTime(d.createdAt)}
                      </TD>
                      <TD mobile="actions">
                        <span className="flex flex-wrap items-center justify-end gap-2">
                          {canUpdate ? <DonationActions donation={{ id: d.id, donationNo: d.donationNo, status: d.status, gateway: d.gateway, amount: d.amount, donorDisplay: d.donorDisplay, campaign: d.campaign?.title ?? null }} /> : <span className="text-xs text-muted">—</span>}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
              <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
