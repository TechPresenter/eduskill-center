import { greeting } from "@/lib/utils";

export interface HomeGreetingProps {
  name: string;
  /** Server-rendered "now" so the greeting matches the request, not the client clock. */
  now?: Date;
}

/**
 * App-home salutation: time-of-day greeting + first name.
 *
 * Deliberately has no notification bell or other navigation: the portal app bar already
 * owns the bell (with the unread badge), the avatar and the drawer on every page, and the
 * spec forbids duplicate navigation on mobile.
 */
export function HomeGreeting({ name, now }: HomeGreetingProps) {
  const firstName = name.split(" ")[0] || name;
  return (
    <div className="min-w-0">
      <p className="text-body-sm font-medium text-muted">{greeting(now ?? new Date())},</p>
      <h1 className="truncate text-h3 text-navy">{firstName}</h1>
    </div>
  );
}
