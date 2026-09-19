/**
 * Renders a JSON-LD structured-data block. The payload is serialised JSON built by our
 * own code (never raw user HTML); `<` is escaped so content can never close the script tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
