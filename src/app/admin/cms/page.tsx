import Link from "next/link";
import { ArrowRight, BookMarked, CalendarDays, FileText, Handshake, HelpCircle, Image as ImageIcon, LayoutTemplate, Newspaper, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/utils";
import { CMS_SECTIONS } from "@/lib/cms/sections";
import { listSectionsWithState } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Website Content" };

export default async function CmsOverviewPage() {
  await requireAdmin("cms.view");
  const [sections, pages, programs, stories, partners, blogs, events, faqs, gallery] = await Promise.all([
    listSectionsWithState(),
    db.cmsPage.groupBy({ by: ["status"], _count: { _all: true } }),
    db.program.groupBy({ by: ["isActive"], _count: { _all: true } }),
    db.successStory.groupBy({ by: ["isPublished"], _count: { _all: true } }),
    db.partner.groupBy({ by: ["isActive"], _count: { _all: true } }),
    db.blog.groupBy({ by: ["status"], _count: { _all: true } }),
    db.event.groupBy({ by: ["status"], _count: { _all: true } }),
    db.faq.groupBy({ by: ["isPublished"], _count: { _all: true } }),
    db.galleryItem.groupBy({ by: ["isPublished"], _count: { _all: true } }),
  ]);
  const sum = <T,>(rows: (T & { _count: { _all: number } })[], pick?: (r: T) => boolean) => rows.filter((r) => (pick ? pick(r) : true)).reduce((n, r) => n + r._count._all, 0);
  const customised = sections.filter((s) => s.customised);
  const recent = [...customised].sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)).slice(0, 5);
  const pageGroups = [...new Set(CMS_SECTIONS.map((s) => s.page))];

  const areas = [
    { href: "/admin/cms/sections", icon: LayoutTemplate, title: "Website sections", total: `${sections.length} sections on ${pageGroups.length} pages`, detail: `${customised.length} customised` },
    { href: "/admin/cms/pages", icon: FileText, title: "Pages", total: `${sum(pages)} pages`, detail: `${sum(pages, (p) => p.status === "PUBLISHED")} published` },
    { href: "/admin/cms/programs", icon: BookMarked, title: "Programs", total: `${sum(programs)} programs`, detail: `${sum(programs, (p) => p.isActive)} active` },
    { href: "/admin/cms/stories", icon: Star, title: "Success stories", total: `${sum(stories)} stories`, detail: `${sum(stories, (s) => s.isPublished)} published` },
    { href: "/admin/cms/partners", icon: Handshake, title: "Partners", total: `${sum(partners)} partners`, detail: `${sum(partners, (p) => p.isActive)} shown` },
    { href: "/admin/blog", icon: Newspaper, title: "Blog", total: `${sum(blogs)} posts`, detail: `${sum(blogs, (b) => b.status === "PUBLISHED")} published` },
    { href: "/admin/events", icon: CalendarDays, title: "Events", total: `${sum(events)} events`, detail: `${sum(events, (e) => e.status === "PUBLISHED")} published` },
    { href: "/admin/faqs", icon: HelpCircle, title: "FAQs", total: `${sum(faqs)} questions`, detail: `${sum(faqs, (f) => f.isPublished)} published` },
    { href: "/admin/gallery", icon: ImageIcon, title: "Gallery", total: `${sum(gallery)} images`, detail: `${sum(gallery, (g) => g.isPublished)} published` },
  ];

  return (
    <div>
      <PageHeader title="Website Content" mobileTitle="Website" description="Everything visitors see on the public website is managed here. Changes go live immediately." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((a) => (
          <Link key={a.href} href={a.href} className="card card-hover flex items-start gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lavender text-navy">
              <a.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-base font-bold text-navy">{a.title}</span>
                <ArrowRight className="h-4 w-4 text-muted" />
              </span>
              <span className="mt-1 block text-sm text-ink">{a.total}</span>
              <span className="block text-xs text-muted">{a.detail}</span>
            </span>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader title="Recently edited sections" description="Website sections that have been customised from the built-in defaults." />
        <CardBody>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">No sections customised yet – the website is showing the built-in defaults.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((s) => (
                <li key={s.key} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={`/admin/cms/sections/${encodeURIComponent(s.key)}`} className="flex min-h-11 items-center font-medium text-ink tap-highlight-none md:min-h-0 md:hover:text-navy">
                    {s.name} <Badge tone="neutral" className="ml-1">{s.page}</Badge>
                  </Link>
                  <span className="text-xs text-muted">
                    {s.updatedBy ? `${s.updatedBy} · ` : ""}
                    {formatDateTime(s.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
