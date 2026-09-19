"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  id: string;
  title: string | null;
  imageUrl: string;
  category: string | null;
  centerName: string | null;
}

/** Responsive masonry-style gallery with a keyboard-navigable lightbox. */
export function GalleryGrid({ items }: { items: GalleryImage[] }) {
  const categories = React.useMemo(() => [...new Set(items.map((i) => i.category?.trim()).filter((c): c is string => !!c))].sort(), [items]);
  const [category, setCategory] = React.useState<string>("all");
  const [index, setIndex] = React.useState<number | null>(null);
  const visible = category === "all" ? items : items.filter((i) => i.category === category);
  const current = index === null ? null : visible[index] ?? null;

  const step = React.useCallback(
    (d: number) => {
      setIndex((i) => (i === null || visible.length === 0 ? i : (i + d + visible.length) % visible.length));
    },
    [visible.length]
  );

  React.useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, step]);

  if (items.length === 0) {
    return <EmptyState title="No photos yet" description="Photos from our training centers and events will appear here once published." />;
  }

  return (
    <div>
      {categories.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter gallery by category">
          {["all", ...categories].map((c) => (
            <button key={c} type="button" onClick={() => { setCategory(c); setIndex(null); }} aria-pressed={category === c} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors", category === c ? "bg-navy text-white" : "bg-lavender text-navy hover:bg-navy-soft")}>
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      )}
      <ul className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>li]:mb-4 [&>li]:break-inside-avoid">
        {visible.map((item, i) => (
          <li key={item.id}>
            <button type="button" onClick={() => setIndex(i)} className="group relative block w-full overflow-hidden rounded-2xl bg-lavender shadow-card focus-visible:ring-2" aria-label={`Open ${item.title ?? "photo"} in lightbox`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={item.title ?? item.centerName ?? "Gallery photo"} loading="lazy" className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <span className="absolute inset-0 flex items-end bg-linear-to-t from-navy/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="flex w-full items-center justify-between text-left text-xs font-semibold text-white">
                  <span className="truncate">{item.title ?? item.centerName ?? ""}</span>
                  <Maximize2 className="h-4 w-4 shrink-0" aria-hidden />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Modal open={current !== null} onClose={() => setIndex(null)} size="xl" title={current?.title ?? current?.centerName ?? "Photo"} description={current?.category ?? undefined}>
        {current && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.imageUrl} alt={current.title ?? "Gallery photo"} className="mx-auto max-h-[70vh] w-auto rounded-xl object-contain" />
            {visible.length > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => step(-1)} className="inline-flex h-10 items-center gap-1 rounded-xl border border-line px-3 text-sm font-semibold text-navy hover:bg-surface" aria-label="Previous photo">
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <span className="text-xs text-muted">
                  {(index ?? 0) + 1} / {visible.length}
                </span>
                <button type="button" onClick={() => step(1)} className="inline-flex h-10 items-center gap-1 rounded-xl border border-line px-3 text-sm font-semibold text-navy hover:bg-surface" aria-label="Next photo">
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
