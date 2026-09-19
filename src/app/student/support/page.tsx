import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, HelpCircle, LifeBuoy, MessageSquare } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { listUserTickets } from "@/server/support";
import { listFaqs } from "@/server/public";
import { getBranding } from "@/lib/settings";
import { formatDateTime, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { TicketForm } from "@/components/student/ticket-form";
import { SupportActions } from "@/components/student/mobile";

export const metadata: Metadata = { title: "Support" };

export default async function StudentSupportPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const user = await requireStudent();
  const { topic } = await searchParams;
  const [tickets, branding, faqs] = await Promise.all([listUserTickets(user.id), getBranding(), listFaqs()]);
  const open = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Support" mobileTitle="Help & Support" description="Call, message or raise a ticket – the Foundation replies here and by notification." />

      {/* Mobile order: contact actions → FAQs → new ticket → your tickets. Desktop keeps tickets first. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="lg:order-2 lg:col-span-1 lg:space-y-6">
          <SupportActions contact={branding.contact} studentId={user.student.studentId} />
        </div>

        {faqs.length > 0 && (
          <section className="lg:order-4 lg:col-span-3" aria-label="Frequently asked questions">
            <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
              <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[0.14em] text-muted uppercase">
                <HelpCircle className="h-4 w-4" aria-hidden /> FAQs
              </h2>
              <Link href="/faq" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-orange">
                View all
              </Link>
            </div>
            <FaqAccordion faqs={faqs.slice(0, 6)} />
          </section>
        )}

        <Card id="new-ticket" className="scroll-mt-20 lg:order-3 lg:col-span-1">
          <CardHeader title="Submit an enquiry" description="Tell us what you need help with and we will reply here." />
          <CardBody>
            <TicketForm topic={topic} />
          </CardBody>
        </Card>

        <div className="lg:order-1 lg:col-span-2">
          <Card>
            <CardHeader title="Your tickets" description={tickets.length ? `${open} open of ${tickets.length}` : undefined} />
            {tickets.length === 0 ? (
              <CardBody>
                <EmptyState icon={<LifeBuoy className="h-7 w-7" />} title="No tickets yet" description="Use “Submit enquiry” to send your first question." />
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/student/support/${t.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 tap-highlight-none hover:bg-surface active:bg-surface">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[12px] text-muted">{t.ticketNo}</span>
                          <StatusBadge status={t.status} />
                          <Badge tone={t.priority === "HIGH" ? "danger" : t.priority === "LOW" ? "neutral" : "warning"}>{titleCase(t.priority)}</Badge>
                        </span>
                        <span className="mt-1 block truncate text-[14px] font-semibold text-ink">{t.subject}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {t.category ? `${t.category} · ` : ""}Updated {formatDateTime(t.updatedAt)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden /> {t._count.messages}
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
