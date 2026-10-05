/**
 * The trust boundary of the public course page.
 *
 * Everything the page renders passes through here first. Two jobs:
 *
 *  1. **Paid material never reaches the markup.** `toPublicCurriculum()` copies the curriculum tree
 *     into a view model that simply has no field for a video or document unless the lesson is
 *     marked `isFreePreview`. The components downstream cannot leak a URL they were never given —
 *     not in the HTML, not in an attribute, not in a React payload — because the string is dropped
 *     before the first component is called. (The curriculum renders as native `<details>` in a
 *     SERVER component for the same reason: a client component would serialise its props into the
 *     RSC payload embedded in the page.)
 *
 *  2. **Files are linked through the access-controlled route.** `resolveFileLink()` turns a stored
 *     URL into `/api/files/<key>` via `fileUrl()`, so the link carries the deployment sub-path and
 *     `GET /api/files/[...key]` still runs its ownership check. A `private/` key is flagged
 *     `requiresLogin` so the UI can say so instead of handing a visitor a link that 401s silently.
 *
 * Server-only: it imports `@/lib/storage` (node:fs). Resolve links here, pass plain strings to any
 * client component.
 */
import type { CourseNodeKind } from "@/generated/prisma/enums";
import type { CourseNodeTreeItem } from "@/server/course-cms";
import { fileUrl, isPrivateKey, keyFromUrl } from "@/lib/storage";
import { withBasePath } from "@/lib/base-path";

export interface PublicLink {
  /** Ready for an `href`: base-path-correct and, for uploads, pointed at the file route. */
  href: string;
  /** An off-site URL — needs `rel="noopener noreferrer"`. */
  external: boolean;
  /** The file sits under `private/`, so the route will demand a session. */
  requiresLogin: boolean;
}

/**
 * A stored URL, a bare storage key or an external link → something safe to put in an `href`.
 * Anything else (`data:`, `javascript:`, a bare word) returns null rather than being rendered.
 */
export function resolveFileLink(url: string | null | undefined): PublicLink | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  const key = keyFromUrl(raw) ?? (/^(public|private)\//.test(raw) && !raw.includes("..") ? raw : null);
  if (key) return { href: fileUrl(key), external: false, requiresLogin: isPrivateKey(key) };
  if (/^https?:\/\//i.test(raw)) return { href: raw, external: true, requiresLogin: false };
  if (raw.startsWith("/")) return { href: withBasePath(raw), external: false, requiresLogin: false };
  return null;
}

/**
 * Same resolution for an `<img src>`, with one extra rule: a `private/` upload resolves to null.
 * A public page cannot display a file the file route will refuse, and a placeholder is better than
 * a broken image — so the image slot falls back to `MediaPlaceholder` instead.
 */
export function resolveImageSrc(url: string | null | undefined): string | null {
  const link = resolveFileLink(url);
  if (!link || link.requiresLogin) return null;
  if (link.external && !/^https:\/\//i.test(link.href)) return null; // no plain http in an <img src>
  return link.href;
}

export interface NodePreview {
  video: PublicLink | null;
  document: PublicLink | null;
  material: PublicLink | null;
}

export interface PublicCourseNode {
  id: string;
  kind: CourseNodeKind;
  title: string;
  description: string | null;
  durationText: string | null;
  durationMinutes: number | null;
  isFreePreview: boolean;
  /** Openable links. Populated ONLY for a free-preview node; `null` for everything else. */
  preview: NodePreview | null;
  /**
   * WHICH kinds of file the node carries, as booleans — never the URLs. Lets the page count study
   * resources and list their titles without the paths existing outside this module.
   */
  attached: { video: boolean; document: boolean; material: boolean };
  /** This node has attached material that is deliberately not exposed — drives the lock badge. */
  locked: boolean;
  children: PublicCourseNode[];
}

/** Strips every URL off every node that is not a free preview. The one gate; there is no bypass. */
export function toPublicCurriculum(nodes: readonly CourseNodeTreeItem[]): PublicCourseNode[] {
  return nodes.map((n) => {
    const attached = { video: Boolean(n.videoUrl), document: Boolean(n.documentUrl), material: Boolean(n.studyMaterialUrl) };
    const hasAny = attached.video || attached.document || attached.material;
    const preview: NodePreview | null = n.isFreePreview
      ? {
          video: resolveFileLink(n.videoUrl),
          document: resolveFileLink(n.documentUrl),
          material: resolveFileLink(n.studyMaterialUrl),
        }
      : null;
    return {
      id: n.id,
      kind: n.kind,
      title: n.title,
      description: n.description,
      durationText: n.durationText,
      durationMinutes: n.durationMinutes,
      isFreePreview: n.isFreePreview,
      preview,
      attached,
      locked: hasAny && !n.isFreePreview,
      children: toPublicCurriculum(n.children),
    };
  });
}

export interface CurriculumStats {
  sections: number;
  lessons: number;
  totalMinutes: number;
  freePreviews: number;
}

/** Counts for the curriculum header. Every number is counted from the rows — nothing is estimated. */
export function curriculumStats(nodes: readonly PublicCourseNode[]): CurriculumStats {
  const stats: CurriculumStats = { sections: nodes.length, lessons: 0, totalMinutes: 0, freePreviews: 0 };
  const walk = (list: readonly PublicCourseNode[]) => {
    for (const n of list) {
      if (n.kind === "LESSON" || n.children.length === 0) stats.lessons += 1;
      if (n.durationMinutes && n.durationMinutes > 0) stats.totalMinutes += n.durationMinutes;
      if (n.isFreePreview) stats.freePreviews += 1;
      walk(n.children);
    }
  };
  walk(nodes);
  return stats;
}

/** `45 min` · `2 h` · `1 h 30 min`. Empty string for nothing, so a caller can `||` past it. */
export function formatMinutes(minutes: number | null | undefined): string {
  const m = Math.round(minutes ?? 0);
  if (!Number.isFinite(m) || m <= 0) return "";
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} min`;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** Depth-first flat list of every node — for counting, and for the study-material index. */
export function flattenCurriculum(nodes: readonly PublicCourseNode[]): PublicCourseNode[] {
  const out: PublicCourseNode[] = [];
  const walk = (list: readonly PublicCourseNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
