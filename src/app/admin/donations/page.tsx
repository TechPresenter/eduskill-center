import { HandCoins, HandHeart, SearchX } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, formatINR, formatNumber, titleCase } from "@/lib/utils";
import { donationListSchema, listCampaigns, listDonations } from "@/server/donations-admin";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { ExportButton } from "@/components/admin/pickers/export-button";
import { Pager } from "@/components/admin/pickers/pager";
import { CampaignManager } from "@/components/admin/donations/campaign-manager";
import { DonationActions } from "@/components/admin/donations/donation-actions";
import { AppList, AppListRow, IconTile, StatStrip, type TileTone } from "@/components/admin/content/app-list";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Donations" };

const STATUS_TILE: Record<string, TileTone> = { COMPLETED: "success", PENDING: "warning", FAILED: "danger" };

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
    <div className="space-y-4">
      <PageHeader
        title="Donations"
        mobileTitle="Donations"
        description="Fund-raising campaigns and the donations received against them."
        actions={tab === "donations" ? <ExportButton href={withParams("/api/admin/donations/export", sp, { page: undefined, limit: undefined, tab: undefined })} label="Export CSV" /> : undefined}
      />

      <QueryTabs
        param="tab"
        defaultValue="campaigns"
        items={[
          { value: "campaigns", label: "Campaigns", count: campaigns.length },
          { value: "donations", label: "Donations" },
        ]}
      />

      {tab === "campaigns" && (
        <div className="space-y-4">
          <StatStrip
            items={[
              { label: "Active", value: formatNumber(campaigns.filter((c) => c.isActive).length), tone: "success", hint: "campaigns" },
              { label: "Raised", value: formatINR(totalRaised), tone: "orange", hint: "completed only" },
              { label: "Gifts", value: formatNumber(campaigns.reduce((n, c) => n + c.completedCount, 0)), hint: "completed" },
            ]}
          />
          <CampaignManager items={campaigns} canEdit={canUpdate} />
        </div>
      )}

      {tab === "donations" && data && (
        <div className="space-y-4">
          <StatStrip
            items={[
              { label: "In view", value: formatNumber(data.meta.total), hint: "donations" },
              { label: "Completed", value: formatINR(data.completedAmount), tone: "success", hint: `${formatNumber(data.completedCount)} gifts` },
              { label: "To confirm", value: formatNumber(data.items.filter((d) => d.status === "PENDING" && d.gateway === "manual").length), tone: "warning", hint: "on this page" },
            ]}
          />

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
            <EmptyState icon={<HandCoins className="h-7 w-7" />} title="No donations yet" description="Donations made through the website appear here. Offline pledges wait for you to confirm them." />
          ) : data.items.length === 0 ? (
            <EmptyState size="sm" icon={<SearchX className="h-6 w-6" />} title="No donations match" description="Try another status, campaign or date range." action={<ButtonLink href={withParams(base, {}, { tab: "donations" })} variant="outline" size="sm">Clear filters</ButtonLink>} />
          ) : (
            <>
              {/* Phones: amount-first rows. */}
              <AppList aria-label="Donations" className="md:hidden">
                {data.items.map((d) => {
                  const actionable = canUpdate && d.gateway === "manual" && d.status !== "COMPLETED";
                  return (
                    <AppListRow
                      key={d.id}
                      leading={
                        <IconTile tone={STATUS_TILE[d.status] ?? "lavender"}>
                          <HandHeart />
                        </IconTile>
                      }
                      title={<span className="tabular-nums">{formatINR(d.amount)}</span>}
                      subtitle={`${d.donorDisplay} · ${d.campaign?.title ?? "General fund"}${actionable ? ` · ${formatDate(d.createdAt, "dd MMM")}` : ""}`}
                      clamp={1}
                      meta={
                        <>
                          <StatusBadge status={d.status} />
                          <Badge tone={d.gateway === "manual" ? "neutral" : "info"}>{titleCase(d.gateway)}</Badge>
                          <span className="font-mono text-caption text-muted">{d.donationNo}</span>
                        </>
                      }
                      // Two 44px actions leave no room for a date column on a 360px phone; the date moves to the subtitle.
                      trailing={actionable ? undefined : <span className="tabular-nums">{formatDate(d.createdAt, "dd MMM")}</span>}
                      actions={actionable ? <DonationActions compact donation={{ id: d.id, donationNo: d.donationNo, status: d.status, gateway: d.gateway, amount: d.amount, donorDisplay: d.donorDisplay, campaign: d.campaign?.title ?? null }} /> : undefined}
                    />
                  );
                })}
              </AppList>

              {/* md+: table. */}
              <div className="hidden md:block">
                <TableWrap cards={false}>
                  <THead>
                    <tr>
                      <TH>Donation</TH>
                      <TH>Donor</TH>
                      <TH>Campaign</TH>
                      <TH className="text-right">Amount</TH>
                      <TH>Gateway</TH>
                      <TH>Status</TH>
                      <TH>Received</TH>
                      <TH>
                        <span className="sr-only">Actions</span>
                      </TH>
                    </tr>
                  </THead>
                  <TBody>
                    {data.items.map((d) => (
                      <TR key={d.id}>
                        <TD>
                          <span className="font-mono text-caption font-semibold text-navy">{d.donationNo}</span>
                          {d.gatewayPaymentId && <span className="block max-w-[10rem] truncate text-caption text-muted">{d.gatewayPaymentId}</span>}
                        </TD>
                        <TD>
                          <span className="block font-medium">{d.donorDisplay}</span>
                          {!d.isAnonymous && <span className="block text-caption font-normal text-muted">{[d.email, d.mobile].filter(Boolean).join(" · ") || "—"}</span>}
                          {d.pan && !d.isAnonymous && <span className="block text-caption font-normal text-muted">PAN {d.pan}</span>}
                        </TD>
                        <TD>{d.campaign?.title ?? <span className="text-caption text-muted">General fund</span>}</TD>
                        <TD className="text-right font-semibold text-navy tabular-nums">{formatINR(d.amount)}</TD>
                        <TD>
                          <Badge tone={d.gateway === "manual" ? "neutral" : "info"}>{titleCase(d.gateway)}</Badge>
                        </TD>
                        <TD>
                          <StatusBadge status={d.status} />
                        </TD>
                        <TD className="whitespace-nowrap text-muted tabular-nums">{formatDateTime(d.createdAt)}</TD>
                        <TD className="text-right">{canUpdate ? <DonationActions donation={{ id: d.id, donationNo: d.donationNo, status: d.status, gateway: d.gateway, amount: d.amount, donorDisplay: d.donorDisplay, campaign: d.campaign?.title ?? null }} /> : null}</TD>
                      </TR>
                    ))}
                  </TBody>
                </TableWrap>
              </div>
              <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
