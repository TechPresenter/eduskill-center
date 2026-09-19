import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber } from "@/lib/utils";
import { galleryListSchema, listGallery } from "@/server/content";
import { cmsPickerOptions } from "@/server/cms-admin";
import { PageHeader } from "@/components/ui/misc";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { GalleryManager } from "@/components/admin/content/gallery-manager";
import { Pager } from "@/components/admin/content/pager";
import { flattenSearchParams, parseListQuery, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Gallery" };

export default async function GalleryPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("cms.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(galleryListSchema.extend({ limit: galleryListSchema.shape.limit.default(40) }), sp);
  const [data, options] = await Promise.all([listGallery(q), cmsPickerOptions()]);
  const base = "/admin/gallery";

  return (
    <div>
      <PageHeader title="Gallery" mobileTitle="Gallery" description={`${formatNumber(data.meta.total)} image${data.meta.total === 1 ? "" : "s"} in the current view. Published images appear in the website gallery and on center pages.`} />

      <FilterBar
        fields={[
          { type: "search", placeholder: "Caption or category" },
          { type: "select", name: "category", label: "Category", options: data.categories.map((c) => ({ value: c, label: c })), placeholder: data.categories.length ? "All categories" : "No categories yet" },
          { type: "select", name: "centerId", label: "Training center", options: options.centers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })), placeholder: "All centers" },
          {
            type: "select",
            name: "published",
            label: "Visibility",
            options: [
              { value: "true", label: "Published" },
              { value: "false", label: "Hidden" },
            ],
          },
        ]}
      />

      <GalleryManager items={data.items} categories={data.categories} centers={options.centers} canEdit={hasPermission(user, "cms.update")} />
      <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
    </div>
  );
}
