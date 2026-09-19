import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/utils";
import { listSectionsWithState } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Website Sections" };

export default async function CmsSectionsPage() {
  await requireAdmin("cms.view");
  const sections = await listSectionsWithState();
  const pages = [...new Set(sections.map((s) => s.page))];

  return (
    <div>
      <PageHeader title="Website sections" mobileTitle="Sections" backHref="/admin/cms" description="Headlines, text, images and lists for each part of the public website, grouped by page." />
      <div className="space-y-6">
        {pages.map((page) => (
          <section key={page} aria-labelledby={`page-${page}`}>
            <h2 id={`page-${page}`} className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
              {page}
            </h2>
            <ul className="divide-y divide-line rounded-card border border-line bg-white">
              {sections
                .filter((s) => s.page === page)
                .map((s) => (
                  <li key={s.key}>
                    <Link href={`/admin/cms/sections/${encodeURIComponent(s.key)}`} className="flex min-h-14 items-center gap-4 px-4 py-4 tap-highlight-none transition-colors active:bg-surface sm:px-5 md:hover:bg-surface/60">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{s.name}</span>
                          {s.customised ? <Badge tone="orange">Customised</Badge> : <Badge tone="neutral">Default</Badge>}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">{s.description}</span>
                        <span className="mt-1 block text-xs text-muted">
                          {s.fieldCount} field{s.fieldCount === 1 ? "" : "s"}
                          {s.updatedAt ? ` · last saved ${formatDateTime(s.updatedAt)}${s.updatedBy ? ` by ${s.updatedBy}` : ""}` : ""}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
