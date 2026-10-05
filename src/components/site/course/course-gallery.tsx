import { Media } from "@/components/site/safe-image";

export interface CourseGalleryImage {
  id: string;
  src: string;
  alt: string | null;
  caption: string | null;
}

/**
 * A row of course photographs. Edge-to-edge snap scroller on phones (`hscroll`, the one deliberate
 * horizontal scroll), a grid from `sm` up. Captions render only when the Foundation wrote one.
 */
export function CourseGallery({ images, seed, label }: { images: CourseGalleryImage[]; seed: string; label: string }) {
  if (images.length === 0) return null;
  return (
    <ul aria-label={label} className="hscroll gap-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
      {images.map((img) => (
        <li key={img.id} className="w-[78vw] max-w-sm sm:w-auto sm:max-w-none">
          <figure className="card overflow-hidden">
            <Media src={img.src} alt={img.alt ?? ""} seed={`${seed}-${img.id}`} ratio="4x3" sizes="(max-width: 640px) 78vw, (max-width: 1024px) 50vw, 360px" />
            {img.caption && <figcaption className="px-4 py-3 text-body-sm text-muted">{img.caption}</figcaption>}
          </figure>
        </li>
      ))}
    </ul>
  );
}
