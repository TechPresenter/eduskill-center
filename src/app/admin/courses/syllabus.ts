/** Normalises the JSON `syllabus` column into the shape the editor and detail page expect. */
export function parseSyllabus(value: unknown): { module: string; title: string; topics: string[] }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, i) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const mod = o.module === undefined || o.module === null || o.module === "" ? `Module ${i + 1}` : typeof o.module === "number" ? `Module ${o.module}` : String(o.module);
      const title = typeof o.title === "string" ? o.title : "";
      const topics = Array.isArray(o.topics) ? o.topics.filter((t): t is string => typeof t === "string" && t.trim().length > 0) : [];
      return { module: mod, title, topics };
    })
    .filter((m): m is { module: string; title: string; topics: string[] } => m !== null);
}
