"use client";

import { LinkTabs } from "@/components/ui/tabs";

/** Tab strip shared by every settings page (setting groups + document types + impact stats). */
export function SettingsTabs({ groups }: { groups: { key: string; label: string }[] }) {
  return (
    <LinkTabs
      className="mb-6"
      items={[
        ...groups.map((g) => ({ href: `/admin/settings/${g.key}`, label: g.label, exact: true })),
        { href: "/admin/settings/document-types", label: "Document types", exact: true },
        { href: "/admin/settings/impact-stats", label: "Impact stats", exact: true },
      ]}
    />
  );
}
