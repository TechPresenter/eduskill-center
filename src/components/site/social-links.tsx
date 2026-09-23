import { cn } from "@/lib/utils";
import type { Branding } from "@/lib/settings";

/**
 * The Foundation's social profiles, as circular icon buttons with a brand-coloured fill that grows
 * from the centre on hover / focus.
 *
 * SERVER COMPONENT on purpose — the whole effect is CSS, so the topbar and the footer both get it
 * without shipping a byte of JavaScript.
 *
 * WHY INLINE SVG: lucide-react carries no brand marks (there is no `Facebook`, `Instagram`,
 * `Twitter`, `Linkedin` or `Youtube` export in 1.47), and a remote logo sprite is not an option on
 * this site. Each mark below is the plain monochrome glyph, drawn on lucide's own 24×24 grid so it
 * sits at the same optical weight as every other icon in the product.
 *
 * Nothing is rendered for a network whose URL is empty: a social row on this site is always a row of
 * links that actually go somewhere.
 */

type SocialKey = "facebook" | "instagram" | "twitter" | "linkedin" | "youtube" | "whatsapp";

interface NetworkDef {
  key: SocialKey;
  /** Spoken name — goes into the link's accessible name, so it reads as a destination. */
  label: string;
  /**
   * The fill that grows from the centre. These are the networks' own colours, written as literal
   * arbitrary values so Tailwind's scanner emits them; Instagram has no single colour, so it keeps
   * its well-known corner-to-corner gradient.
   */
  fill: string;
  path: string;
}

const NETWORKS: NetworkDef[] = [
  {
    key: "facebook",
    label: "Facebook",
    fill: "bg-[#1877F2]",
    path: "M14 8h2.5V4.5H14c-2.5 0-4 1.6-4 4V11H7.5v3.5H10V20h3.5v-5.5h2.6l.5-3.5h-3.1V9c0-.6.4-1 1-1Z",
  },
  {
    key: "instagram",
    label: "Instagram",
    fill: "bg-[radial-gradient(circle_at_28%_108%,#FDF497_0%,#FD5949_45%,#D6249F_62%,#285AEB_95%)]",
    path: "M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Zm4 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm4.6-3.3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
  },
  {
    key: "twitter",
    label: "X, formerly Twitter",
    fill: "bg-[#000000]",
    path: "M4 4h4.3l3.9 5.4L16.9 4H20l-6.3 7.2L20.5 20h-4.3l-4.2-5.8L6.9 20H3.8l6.7-7.6L4 4Zm2.9 1.5 9.4 13h1.4L8.4 5.5H6.9Z",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    fill: "bg-[#0A66C2]",
    path: "M5.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.8 9h3.4v11H3.8V9Zm5.7 0h3.3v1.5c.5-.9 1.7-1.8 3.5-1.8 3.6 0 4.3 2.4 4.3 5.4V20h-3.4v-5.2c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V20H9.5V9Z",
  },
  {
    key: "youtube",
    label: "YouTube",
    fill: "bg-[#FF0000]",
    path: "M21.6 7.2a2.5 2.5 0 0 0-1.7-1.8C18.3 5 12 5 12 5s-6.3 0-7.9.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.7 1.8c1.6.4 7.9.4 7.9.4s6.3 0 7.9-.4a2.5 2.5 0 0 0 1.7-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    fill: "bg-[#25D366]",
    path: "M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.2 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 2a7.8 7.8 0 1 1-4 14.5l-.35-.2-2.4.63.64-2.32-.22-.35A7.8 7.8 0 0 1 12 4.2ZM8.85 8.3c-.15 0-.4.05-.6.28-.2.23-.78.76-.78 1.85 0 1.09.8 2.14.91 2.29.11.15 1.55 2.47 3.83 3.36 1.9.74 2.29.6 2.7.56.41-.04 1.33-.54 1.52-1.07.19-.53.19-.98.13-1.07-.06-.09-.21-.15-.45-.26-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.11-.53.11-.16.23-.61.77-.75.93-.14.15-.28.17-.51.06-.24-.12-1-.37-1.9-1.17-.7-.62-1.18-1.4-1.32-1.63-.14-.23-.02-.35.1-.47.11-.1.24-.28.36-.42.12-.14.16-.23.24-.39.08-.15.04-.29-.02-.4-.06-.12-.53-1.3-.73-1.78-.19-.46-.38-.4-.53-.41h-.45Z",
  },
];

export interface SocialLinksProps {
  /** `branding.social` — a map of network key to URL. Empty strings are skipped. */
  social: Branding["social"];
  /** `branding.contact.whatsapp` — a bare number; becomes a wa.me link when set. */
  whatsapp?: string;
  /** Organisation name, used to build "… on Facebook (opens in a new tab)". */
  siteName: string;
  /**
   * `md` is the comfortable 44px circle for the footer and phones. `sm` is the 36px circle the slim
   * desktop topbar can afford; its hit area is padded back out to 44px with a transparent ::after,
   * so the target never shrinks with the circle.
   */
  size?: "sm" | "md";
  /**
   * Optional group heading ("Follow Us"). When given, the component wraps itself in a `<section>`,
   * renders the heading above the row and names the list with it — so the whole group, heading
   * included, disappears together when no social URL is set.
   */
  heading?: string;
  className?: string;
}

/** `+91 98765 43210` / `9876543210` → `919876543210`, the shape wa.me expects. */
function waNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.length === 10 ? `91${digits}` : digits;
}

export function SocialLinks({ social, whatsapp = "", siteName, size = "md", heading, className }: SocialLinksProps) {
  const wa = waNumber(whatsapp);
  const links = NETWORKS.map((n) => {
    const href = n.key === "whatsapp" ? (wa ? `https://wa.me/${wa}` : "") : (social[n.key as keyof Branding["social"]] ?? "");
    return { ...n, href };
  }).filter((n) => !!n.href && /^https?:\/\//i.test(n.href));

  if (links.length === 0) return null;

  const list = (
    <ul aria-label={heading ? undefined : `${siteName} on social media`} className={cn("flex flex-wrap items-center", size === "sm" ? "gap-1.5" : "gap-2.5", heading ? "mt-3" : className)}>
      {links.map((n) => (
        <li key={n.key}>
          <a
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${siteName} on ${n.label} (opens in a new tab)`}
            className={cn(
              // `relative` anchors both the fill and the ::after hit area. Deliberately NOT
              // overflow-hidden: that would clip the padded hit area away again.
              "group relative inline-flex items-center justify-center rounded-full bg-white/10 text-white",
              "ring-1 ring-inset ring-white/25 ring-focus-inverse tap-highlight-none",
              "transition-[box-shadow,transform] duration-element ease-soft motion-reduce:transition-none",
              // The 2px lift is motion-SAFE only, so reduced motion still gets the colour change and
              // nothing moves. No `motion-reduce:` override is needed, and nothing has to out-specify
              // the global reduced-motion backstop.
              "motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5",
              "hover:ring-white/40 focus-visible:ring-white/40",
              size === "sm"
                ? // 36px circle, 44px target: the transparent ::after adds 4px all round.
                  "h-9 w-9 after:absolute after:-inset-1 after:rounded-full after:content-['']"
                : "h-11 w-11"
            )}
          >
            {/*
              The effect background. It grows from the centre over --duration-element; under reduced
              motion the scale utilities are simply never applied (motion-safe:), so the colour still
              arrives — instantly, and without movement.
            */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 rounded-full opacity-0 transition-[opacity,transform] duration-element ease-soft",
                "motion-safe:scale-50 motion-safe:group-hover:scale-100 motion-safe:group-focus-visible:scale-100",
                "group-hover:opacity-100 group-focus-visible:opacity-100",
                n.fill
              )}
            />
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cn("relative", size === "sm" ? "h-4 w-4" : "h-5 w-5")}>
              <path d={n.path} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );

  if (!heading) return list;

  return (
    <section aria-label={heading} className={className}>
      <h3 className="text-overline text-white/70">{heading}</h3>
      {list}
    </section>
  );
}
