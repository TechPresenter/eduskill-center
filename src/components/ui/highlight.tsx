import * as React from "react";

/**
 * Renders CMS text where `[[word]]` becomes an orange highlight and newlines become <br/>.
 */
export function Highlight({ text, className, highlightClassName = "text-orange" }: { text: string; className?: string; highlightClassName?: string }) {
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
