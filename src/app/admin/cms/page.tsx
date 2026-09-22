import Link from "next/link";
import { BookMarked, CalendarDays, ChevronRight, FileText, Handshake, HelpCircle, History, Image as ImageIcon, LayoutTemplate, Newspaper, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/utils";
import { CMS_SECTIONS } from "@/lib/cms/sections";
import { listSectionsWithState } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { AppListRow, IconTile } from "@/components/admin/content/app-list";

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
      {/* Tiles: two across on phones (an app home screen), three on desktop. */}
      <ul className="grid animate-fade-in grid-cols-2 gap-3 motion-reduce:animate-none sm:gap-4 lg:grid-cols-3" aria-label="Website content areas">
        {areas.map((a) => (
          <li key={a.href} className="min-w-0">
            <Link href={a.href} className="card card-hover ring-focus flex h-full flex-col gap-3 p-4 tap-highlight-none sm:flex-row sm:items-start sm:gap-4 sm:p-5">
              <IconTile>
                <a.icon />
              </IconTile>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-body font-bold text-navy">{a.title}</span>
                  <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted/70 sm:block" aria-hidden />
                </span>
                <span className="mt-1 block text-body-sm text-ink tabular-nums">{a.total}</span>
                <span className="block text-caption text-muted tabular-nums">{a.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Card className="mt-4 lg:mt-6">
        <CardHeader title="Recently edited sections" description="Website sections that have been customised from the built-in defaults." />
        {recent.length === 0 ? (
          <EmptyState bare size="sm" icon={<History className="h-6 w-6" />} title="Nothing customised yet" description="The website is showing the built-in defaults. Edit a section to make it your own." />
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((s) => (
              <AppListRow
                key={s.key}
                href={`/admin/cms/sections/${encodeURIComponent(s.key)}`}
                leading={
                  <IconTile tone="orange" size="sm">
                    <LayoutTemplate />
                  </IconTile>
                }
                title={s.name}
                subtitle={`${s.updatedBy ? `${s.updatedBy} · ` : ""}${formatDateTime(s.updatedAt)}`}
                clamp={1}
                trailing={<Badge tone="neutral">{s.page}</Badge>}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
