import { LinkTabs } from "@/components/ui/tabs";

export const SECURITY_BASE = "/admin/security";

/**
 * The Security Center's section strip. Settings is listed for the Super Admin only (the page itself is
 * also guarded by requireSuperAdmin). Server-safe: it only hands plain items to the client LinkTabs.
 */
export function SecurityTabs({ superAdmin }: { superAdmin: boolean }) {
  const items = [
    { href: SECURITY_BASE, label: "Overview", exact: true },
    { href: `${SECURITY_BASE}/sessions`, label: "Sessions" },
    { href: `${SECURITY_BASE}/activity`, label: "Sign-in activity" },
    { href: `${SECURITY_BASE}/admins`, label: "Administrators" },
    { href: `${SECURITY_BASE}/alerts`, label: "Alerts" },
    ...(superAdmin ? [{ href: `${SECURITY_BASE}/settings`, label: "Settings" }] : []),
  ];
  return <LinkTabs items={items} />;
}
