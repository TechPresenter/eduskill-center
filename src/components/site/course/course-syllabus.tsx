/**
 * The pre-CMS syllabus: a JSON array on `Course.syllabus`, written before `CourseNode` existed.
 *
 * Kept as the fallback for Course Content so the ~25 courses already on the site do not lose their
 * outline the day the Course CMS ships. The moment the Foundation builds a real curriculum for a
 * course, `CourseCurriculum` takes the section over and this is not rendered.
 */
export interface SyllabusModule {
  module?: number;
  title: string;
  topics?: string[];
}

function toSyllabusModule(item: unknown, index: number): SyllabusModule | null {
  if (typeof item === "string") return item.trim() ? { module: index + 1, title: item } : null;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : typeof o.name === "string" ? o.name : "";
    if (!title) return null;
    const topics = Array.isArray(o.topics) ? o.topics.filter((t): t is string => typeof t === "string") : undefined;
    return { module: typeof o.module === "number" ? o.module : index + 1, title, topics };
  }
  return null;
}

/** Tolerant parse: anything unrecognised is skipped rather than crashing the page. */
export function parseSyllabus(raw: unknown): SyllabusModule[] {
  if (!Array.isArray(raw)) return [];
  const out: SyllabusModule[] = [];
  raw.forEach((item, i) => {
    const m = toSyllabusModule(item, i);
    if (m) out.push(m);
  });
  return out;
}

export function CourseSyllabus({ modules }: { modules: SyllabusModule[] }) {
  if (modules.length === 0) return null;
  return (
    <ol className="space-y-3">
      {modules.map((m, i) => (
        <li key={`${m.title}-${i}`} className="card flex gap-4 card-p">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-orange-light font-heading text-body-sm font-extrabold text-orange tabular-nums">
            {String(m.module ?? i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <h3 className="text-h4 text-navy">{m.title}</h3>
            {m.topics && m.topics.length > 0 && <p className="mt-1 text-body-sm text-muted">{m.topics.join(" · ")}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
