import { greeting } from "@/lib/utils";

export interface TrainerGreetingProps {
  name: string;
  /** Server-rendered "now" so the greeting matches the request, not the client clock. */
  now?: Date;
  /** Second line under the name — today's date, or what needs doing. */
  subtitle?: string;
}

/**
 * App-home salutation on the trainer phone home: time-of-day greeting + first name.
 *
 * Deliberately carries no navigation of its own — the portal app bar already owns the bell (with the
 * unread badge), the avatar and the drawer on every page. Matches the student portal's HomeGreeting
 * so the two portals read as one product.
 */
export function TrainerGreeting({ name, now, subtitle }: TrainerGreetingProps) {
  const firstName = name.split(" ")[0] || name;
  return (
    <div className="min-w-0">
      <p className="text-body-sm font-medium text-muted">{greeting(now ?? new Date())},</p>
      <h1 className="truncate text-h3 text-navy">{firstName}</h1>
      {subtitle && <p className="mt-0.5 truncate text-caption text-muted">{subtitle}</p>}
    </div>
  );
}
