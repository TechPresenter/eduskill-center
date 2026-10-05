import Link from "next/link";
import { ChevronDown, Download, FileText, Lock, LogIn, PlayCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMinutes, type PublicCourseNode, type PublicLink } from "@/components/site/course/public-view";
import { titleCase } from "@/lib/utils";

/**
 * Course Content — the recursive curriculum as collapsible sections.
 *
 * A SERVER component on purpose, built on native `<details>`/`<summary>`:
 *   - it opens with no JavaScript, is keyboard- and screen-reader-correct for free, and the first
 *     section is interactive the moment the HTML lands on a cheap Android phone;
 *   - and, unlike a client component, its props are never serialised into the page. Paid material
 *     is already stripped upstream by `toPublicCurriculum()` (a non-preview node simply has no
 *     `preview` object), so a locked lesson keeps its video and document URLs out of the markup
 *     entirely — not in an href, not in a data attribute, not in an RSC payload.
 *
 * Depth is whatever the Foundation built: MODULE, CHAPTER, TOPIC, LESSON. Any node with children
 * renders as a nested collapsible; any node without them renders as a row.
 */
export function CourseCurriculum({
  nodes,
  signInHref,
  defaultOpenFirst = true,
}: {
  nodes: PublicCourseNode[];
  /** Where a preview whose file is private sends the visitor, instead of printing the file path. */
  signInHref: string;
  defaultOpenFirst?: boolean;
}) {
  if (nodes.length === 0) return null;
  return (
    <ol className="space-y-3">
      {nodes.map((node, i) => (
        <li key={node.id}>
          <CurriculumSection node={node} index={i} open={defaultOpenFirst && i === 0} signInHref={signInHref} />
        </li>
      ))}
    </ol>
  );
}

function CurriculumSection({ node, index, open, signInHref }: { node: PublicCourseNode; index: number; open: boolean; signInHref: string }) {
  const meta = sectionMeta(node);
  // A top-level node with nothing under it is a single item, not an empty accordion.
  if (node.children.length === 0) {
    return (
      <div className="card px-4 py-3 sm:px-5">
        <CurriculumLeafBody node={node} signInHref={signInHref} />
      </div>
    );
  }
  return (
    <details className="group card overflow-hidden transition-shadow duration-micro ease-soft open:shadow-e2 motion-reduce:transition-none" open={open}>
      <summary className="ring-focus flex cursor-pointer list-none items-center gap-3 px-4 py-4 text-left marker:content-none hover:bg-surface group-open:bg-surface sm:px-5 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange-light font-heading text-body-sm font-extrabold text-orange tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-h4 text-navy">{node.title}</span>
          {meta && <span className="mt-0.5 block text-body-sm text-muted">{meta}</span>}
        </span>
        {node.isFreePreview && (
          <Badge tone="success" className="max-sm:hidden">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Preview
          </Badge>
        )}
        <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-muted transition-transform duration-micro ease-soft group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="border-t border-line">
        {node.description && <p className="px-4 pt-4 text-body text-muted sm:px-5">{node.description}</p>}
        <CurriculumChildren nodes={node.children} signInHref={signInHref} />
      </div>
    </details>
  );
}

function CurriculumChildren({ nodes, signInHref }: { nodes: PublicCourseNode[]; signInHref: string }) {
  return (
    <ul className="divide-y divide-line">
      {nodes.map((child) =>
        child.children.length > 0 ? (
          <li key={child.id}>
            <details className="group/sub">
              <summary className="ring-focus flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-left marker:content-none hover:bg-surface sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-ink">{child.title}</span>
                  {sectionMeta(child) && <span className="mt-0.5 block text-body-sm text-muted">{sectionMeta(child)}</span>}
                </span>
                <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-muted transition-transform duration-micro ease-soft group-open/sub:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="bg-surface pl-3 sm:pl-5">
                <CurriculumChildren nodes={child.children} signInHref={signInHref} />
              </div>
            </details>
          </li>
        ) : (
          <li key={child.id} className="px-4 py-3 sm:px-5">
            <CurriculumLeafBody node={child} signInHref={signInHref} />
          </li>
        )
      )}
    </ul>
  );
}

interface LeafLink {
  key: string;
  link: PublicLink;
  label: string;
  icon: typeof PlayCircle;
}

/** One lesson / topic row. Links appear only when `node.preview` exists — i.e. a free preview. */
function CurriculumLeafBody({ node, signInHref }: { node: PublicCourseNode; signInHref: string }) {
  const duration = node.durationText?.trim() || formatMinutes(node.durationMinutes);
  const links: LeafLink[] = [];
  if (node.preview) {
    if (node.preview.video) links.push({ key: "video", link: node.preview.video, label: "Watch preview", icon: PlayCircle });
    if (node.preview.document) links.push({ key: "document", link: node.preview.document, label: "Open notes", icon: FileText });
    if (node.preview.material) links.push({ key: "material", link: node.preview.material, label: "Download material", icon: Download });
  }

  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-muted">
        {node.preview ? <PlayCircle className="h-5 w-5 text-orange" /> : node.locked ? <Lock className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-body font-medium text-ink">
          <span className="min-w-0">{node.title}</span>
          {node.kind !== "LESSON" && <span className="text-caption font-semibold text-muted uppercase">{titleCase(node.kind)}</span>}
          {node.isFreePreview && (
            <Badge tone="success">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Preview
            </Badge>
          )}
        </p>
        {node.description && <p className="mt-1 text-body-sm text-muted">{node.description}</p>}
        {links.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-x-4">
            {links.map(({ key, link, label, icon: Icon }) =>
              // A preview stored as a private upload sends the visitor to sign in. The file path is
              // never printed: a public page must not publish a `private/` storage key, even one
              // the file route would refuse.
              link.requiresLogin ? (
                <Link key={key} href={signInHref} className="ring-focus inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-orange hover:underline">
                  <LogIn className="h-4 w-4" aria-hidden />
                  Sign in to open
                </Link>
              ) : (
                <a
                  key={key}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="ring-focus inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-orange hover:underline"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </a>
              )
            )}
          </p>
        )}
        {/* Locked material is announced, never linked: this branch contains no URL at all. */}
        {node.locked && <p className="mt-1 text-body-sm text-muted">Video and notes unlock when you enrol.</p>}
      </div>
      {duration && <span className="shrink-0 text-body-sm text-muted tabular-nums">{duration}</span>}
    </div>
  );
}

/** "4 chapters · 2 h 10 min" — counted from the rows, never estimated. */
function sectionMeta(node: PublicCourseNode): string {
  const parts: string[] = [];
  const first = node.children[0];
  if (first) {
    const kind = first.kind.toLowerCase();
    parts.push(`${node.children.length} ${node.children.length === 1 ? kind : kind + "s"}`);
  }
  const duration = node.durationText?.trim() || formatMinutes(node.durationMinutes) || formatMinutes(subtreeMinutes(node));
  if (duration) parts.push(duration);
  return parts.join(" · ");
}

function subtreeMinutes(node: PublicCourseNode): number {
  return node.children.reduce((sum, c) => sum + (c.durationMinutes ?? 0) + subtreeMinutes(c), 0);
}
