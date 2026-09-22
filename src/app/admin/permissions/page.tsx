import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { formatNumber } from "@/lib/utils";
import { listRoles, permissionCatalog } from "@/server/roles";
import { PageHeader } from "@/components/ui/misc";
import { ButtonLink, IconButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { PermissionCatalog } from "@/components/admin/roles/permission-catalog";

export const metadata: Metadata = { title: "Permissions · Foundation Admin" };

export default async function PermissionsPage() {
  await requireAdmin("roles.view");
  const [catalog, roles] = await Promise.all([permissionCatalog(), listRoles()]);
  const total = catalog.reduce((n, m) => n + m.permissions.length, 0);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Permission catalog"
        mobileTitle="Permissions"
        backHref="/admin/roles"
        description={`${formatNumber(total)} permissions across ${catalog.length} modules. Permissions are defined in code (module.action); roles and direct grants reference them.`}
        actions={
          <ButtonLink href="/admin/roles" variant="outline" size="sm" leftIcon={<ShieldCheck className="h-4 w-4" />}>
            Manage roles
          </ButtonLink>
        }
        mobileActions={<IconButtonLink href="/admin/roles" icon={<ShieldCheck className="h-5 w-5" />} aria-label="Manage roles" />}
      />
      <Alert tone="info">The Super Admin implicitly holds every permission and cannot be restricted. Staff receive permissions through their role plus any direct grants on their profile.</Alert>
      <PermissionCatalog
        roles={roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))}
        modules={catalog.map((m) => ({ key: m.key, label: m.label, permissions: m.permissions.map((p) => ({ key: p.key, label: p.label, roles: p.roles, directStaffCount: p.directStaffCount })) }))}
      />
    </div>
  );
}
