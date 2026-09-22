import { LayoutTemplate } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/utils";
import { listSectionsWithState } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { AppList, AppListRow, IconTile, ListSection } from "@/components/admin/content/app-list";

export const metadata = { title: "Website Sections" };

export default async function CmsSectionsPage() {
  await requireAdmin("cms.view");
  const sections = await listSectionsWithState();
  const pages = [...new Set(sections.map((s) => s.page))];

  return (
    <div>
      <PageHeader title="Website sections" mobileTitle="Sections" backHref="/admin/cms" description="Headlines, text, images and lists for each part of the public website, grouped by page." />
      <div className="space-y-6">
        {pages.map((page) => {
          const rows = sections.filter((s) => s.page === page);
          const id = `page-${page.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
          return (
            <ListSection key={page} id={id} title={page} count={rows.length}>
              <AppList aria-labelledby={id}>
                {rows.map((s) => (
                  <AppListRow
                    key={s.key}
                    href={`/admin/cms/sections/${encodeURIComponent(s.key)}`}
                    leading={
                      <IconTile tone={s.customised ? "orange" : "lavender"}>
                        <LayoutTemplate />
                      </IconTile>
                    }
                    title={s.name}
                    subtitle={s.description}
                    meta={
                      <>
                        {s.customised ? <Badge tone="orange">Customised</Badge> : <Badge tone="neutral">Default</Badge>}
                        <span className="text-caption text-muted tabular-nums">
                          {s.fieldCount} field{s.fieldCount === 1 ? "" : "s"}
                          {s.updatedAt ? ` · saved ${formatDateTime(s.updatedAt)}${s.updatedBy ? ` by ${s.updatedBy}` : ""}` : ""}
                        </span>
                      </>
                    }
                  />
                ))}
              </AppList>
            </ListSection>
          );
        })}
      </div>
    </div>
  );
}
