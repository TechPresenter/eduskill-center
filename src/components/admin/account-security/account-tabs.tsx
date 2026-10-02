import { LinkTabs } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** "Profile | Security" under the My account header. Profile matches exactly, Security by prefix. */
export function AccountTabs({ className }: { className?: string }) {
  return (
    <LinkTabs
      className={cn("mb-5", className)}
      items={[
        { href: "/admin/account", label: "Profile", exact: true },
        { href: "/admin/account/security", label: "Security" },
      ]}
    />
  );
}

/** The shared desktop page title of both tabs: avatar, name and role. */
export function AccountHeading({ name, avatarUrl, roleLabel }: { name: string; avatarUrl: string | null; roleLabel: string }) {
  return (
    <span className="flex flex-wrap items-center gap-3">
      <Avatar name={name} src={avatarUrl} size={44} />
      {name}
      <Badge tone="navy">{roleLabel}</Badge>
    </span>
  );
}
