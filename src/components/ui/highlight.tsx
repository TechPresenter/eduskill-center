import * as React from "react";

/**
 * Renders CMS text where `[[word]]` becomes a coloured highlight and newlines become <br/>.
 *
 * `highlightClassName` is REQUIRED, deliberately. It used to default to `text-orange`, which meant a
 * caller on a navy band that simply forgot the prop got 2.28:1 silently — that is exactly how the
 * hero slider and the shared page hero shipped failing highlights while every explicit caller was
 * correct. The surface is the caller's knowledge, so the caller has to state it: `text-orange` on a
 * light surface, `text-orange-on-navy` (4.56:1) on navy/navy-dark/a navy gradient.
 */
export function Highlight({ text, className, highlightClassName }: { text: string; className?: string; highlightClassName: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <span className={className}>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {line.split(/(\[\[.+?\]\])/g).map((part, pi) => {
            const m = part.match(/^\[\[(.+)\]\]$/);
            return m ? (
              <span key={pi} className={highlightClassName}>
                {m[1]}
              </span>
            ) : (
              <React.Fragment key={pi}>{part}</React.Fragment>
            );
          })}
          {li < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </span>
  );
}

export function stripHighlight(text: string) {
  return text.replace(/\[\[(.+?)\]\]/g, "$1").replace(/\r?\n/g, " ");
}
