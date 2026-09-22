"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ImageOff, Maximize2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Media, SafeImage } from "@/components/site/safe-image";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  id: string;
  title: string | null;
  imageUrl: string;
  category: string | null;
  centerName: string | null;
}

/**
 * Photo gallery with a keyboard-navigable lightbox.
 *
 * Deliberately a UNIFORM 4/3 grid rather than the masonry it used to be. Masonry needed raw <img>
 * tags of unknown height, which meant no `next/image`, no `sizes`, and a page that reflowed as each
 * photo arrived — expensive on exactly the slow connections our students are on. A fixed ratio lets
 * every tile reserve its box up front, crops every photo the same way, and keeps the rhythm calm.
 */
export function GalleryGrid({ items }: { items: GalleryImage[] }) {
  const categories = React.useMemo(() => [...new Set(items.map((i) => i.category?.trim()).filter((c): c is string => !!c))].sort(), [items]);
  const [category, setCategory] = React.useState<string>("all");
  const [index, setIndex] = React.useState<number | null>(null);
  const visible = category === "all" ? items : items.filter((i) => i.category === category);
  const current = index === null ? null : (visible[index] ?? null);

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
    return (
      <EmptyState
        title="No photos yet"
        description="Classrooms, practical sessions and certificate days will appear here as soon as our centres start sharing them."
      />
    );
  }

  return (
    <div>
      {categories.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter gallery by category">
          {["all", ...categories].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                setIndex(null);
              }}
              aria-pressed={category === c}
              className={cn(
                "ring-focus inline-flex min-h-11 items-center rounded-full border px-5 text-body-sm font-semibold transition-colors duration-micro ease-soft motion-reduce:transition-none",
                category === c ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy/40 hover:bg-lavender"
              )}
            >
              {c === "all" ? "All photos" : c}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState icon={<ImageOff className="h-7 w-7" />} title="Nothing in this category" description="Try another category, or view all photos." action={<Button variant="outline" onClick={() => setCategory("all")}>View all photos</Button>} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {visible.map((item, i) => {
            const caption = item.title ?? item.centerName ?? null;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  className="ring-focus group relative block w-full overflow-hidden rounded-card shadow-e1 transition-shadow duration-micro ease-soft hover:shadow-e2 motion-reduce:transition-none"
                  aria-label={`Open ${caption ?? "photo"} full size`}
                >
                  <Media
                    src={item.imageUrl}
                    alt={caption ?? "Photo from an EduSkill training centre"}
                    seed={item.id}
                    ratio="4x3"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  >
                    {/* Scrim is always present, not hover-only: a touch user has no hover, and the
                        caption is the only thing that says which centre a photo is from. */}
                    <span className="absolute inset-x-0 bottom-0 flex items-end gap-2 bg-linear-to-t from-navy/85 via-navy/35 to-transparent p-3 pt-10">
                      {caption && <span className="min-w-0 flex-1 truncate text-left text-caption font-semibold text-white">{caption}</span>}
                      <Maximize2 className="ml-auto h-4 w-4 shrink-0 text-white/90 transition-transform duration-micro ease-soft group-hover:scale-110 motion-reduce:transition-none" aria-hidden />
                    </span>
                  </Media>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={current !== null} onClose={() => setIndex(null)} size="xl" title={current?.title ?? current?.centerName ?? "Photo"} description={current?.category ?? undefined}>
        {current && (
          <div>
            {/*
             * `object-contain` inside the 4/3 frame: a lightbox must never crop, and portraits and
             * landscapes both have to fit. The frame still reserves its box, so opening a photo does
             * not push the dialog around while the image decodes.
             */}
            <div className="rounded-card">
              <div className="media media-4x3 max-h-[68vh] bg-surface">
                <SafeImage src={current.imageUrl} alt={current.title ?? current.centerName ?? "Gallery photo"} sizes="(max-width: 1024px) 100vw, 900px" className="object-contain" />
              </div>
            </div>
            {visible.length > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <Button variant="outline" onClick={() => step(-1)} aria-label="Previous photo" leftIcon={<ChevronLeft className="h-4 w-4" />}>
                  Prev
                </Button>
                <p className="text-body-sm text-muted tabular-nums" aria-live="polite">
                  {(index ?? 0) + 1} of {visible.length}
                </p>
                <Button variant="outline" onClick={() => step(1)} aria-label="Next photo" rightIcon={<ChevronRight className="h-4 w-4" />}>
                  Next
                </Button>
              </div>
            )}
            <p className="mt-3 hidden text-center text-caption text-muted sm:block">Use the ← and → keys to move between photos.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
