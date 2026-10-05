import { Download, FileText, Lock, LogIn } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { PublicLink } from "@/components/site/course/public-view";

export interface CourseMaterialItem {
  id: string;
  title: string;
  description: string | null;
  /** "PDF · Module 2" — format and where it belongs, when either is known. */
  meta: string | null;
  /**
   * Openable link, or null. A material behind `private/` resolves to null on purpose: the page
   * offers a sign-in link instead, so no private storage key is ever printed into public HTML.
   */
  link: PublicLink | null;
  /** True when the file exists but belongs to enrolled students. */
  locked: boolean;
  /** Locked because the visitor is signed out rather than not enrolled. */
  signInOnly: boolean;
}

/**
 * Study Material.
 *
 * Downloads go through `/api/files/<key>` (built by `fileUrl()`, so the deployment sub-path is
 * carried) and the route re-checks access on every request — nothing here hot-links a storage path,
 * and nothing bypasses the check. A private file is listed by name only, with a sign-in link, so a
 * visitor can see what the course includes without the URL being published.
 */
export function CourseMaterials({ items, signInHref }: { items: CourseMaterialItem[]; signInHref: string }) {
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((m) => (
        <li key={m.id} className="card flex items-start gap-3 card-p">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">
            {m.link ? <Download className="h-5 w-5" /> : m.signInOnly ? <LogIn className="h-5 w-5" /> : <Lock className="h-4.5 w-4.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-body font-semibold break-words text-ink">{m.title}</h3>
            {m.description && <p className="mt-1 text-body-sm text-muted">{m.description}</p>}
            {m.meta && <p className="mt-1 text-caption text-muted uppercase">{m.meta}</p>}
            {m.link ? (
              <a
                href={m.link.href}
                target={m.link.external ? "_blank" : undefined}
                rel={m.link.external ? "noopener noreferrer" : undefined}
                className="ring-focus mt-1 inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-orange hover:underline"
              >
                <FileText className="h-4 w-4" aria-hidden /> Open
              </a>
            ) : m.signInOnly ? (
              <Link href={signInHref} className="ring-focus mt-1 inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-orange hover:underline">
                <LogIn className="h-4 w-4" aria-hidden /> Sign in to download
              </Link>
            ) : (
              <Badge tone="neutral" className="mt-2">
                Included with enrolment
              </Badge>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
