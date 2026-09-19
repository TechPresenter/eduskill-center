import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { SETTING_GROUPS } from "@/lib/settings";
import { db } from "@/lib/db";
import { listDocumentTypes } from "@/app/admin/settings/lib";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsTabs } from "@/components/admin/settings/settings-tabs";
import { DocumentTypesManager } from "@/components/admin/settings/document-types-manager";

export const metadata: Metadata = { title: "Document Types · Foundation Admin" };

export default async function DocumentTypesPage() {
  const user = await requireAdmin("settings.view");
  const [rows, courses] = await Promise.all([listDocumentTypes(), db.course.findMany({ where: { deletedAt: null }, select: { requiredDocuments: true } })]);
  const usage = new Map<string, number>();
  for (const c of courses) for (const k of c.requiredDocuments) usage.set(k, (usage.get(k) ?? 0) + 1);
  return (
    <div>
      <PageHeader title="Settings" mobileTitle="Document types" description="Document types define what students and trainer applicants must upload." />
      <SettingsTabs groups={SETTING_GROUPS} />
      <Card>
        <CardHeader title="Document types" description="Student types can be required per course; trainer types apply to volunteer applications." />
        <CardBody>
          <DocumentTypesManager rows={rows.map((d) => ({ ...d, usedByCourses: usage.get(d.key) ?? 0 }))} canUpdate={hasPermission(user, "settings.update")} />
        </CardBody>
      </Card>
    </div>
  );
}
