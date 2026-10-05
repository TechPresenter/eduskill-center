"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { SafeImage, MediaPlaceholder } from "@/components/site/safe-image";

/**
 * The course promo video: poster first, player only after a click.
 *
 * Nothing third-party loads until the visitor asks for it — no YouTube iframe, no tracking cookie
 * and no 400 KB player on a 3G phone that came to read the fee. A stored upload (or any direct
 * media URL) plays in a native `<video>`; a YouTube or Vimeo link swaps in that provider's
 * privacy-mode embed. An unrecognised or private URL is never passed in: the server resolves it
 * with `resolveFileLink()` first.
 */
export function CoursePromoVideo({
  src,
  poster,
  title,
  seed,
  priority,
}: {
  /** Already resolved on the server: base-path-correct, and never a private storage key. */
  src: string;
  poster?: string | null;
  title: string;
  seed: string;
  /** The banner is the first thing on the page, so its poster is the LCP image. */
  priority?: boolean;
}) {
  const [playing, setPlaying] = React.useState(false);
  const embed = React.useMemo(() => embedUrl(src), [src]);

  if (playing) {
    return (
      // Explicit aspect box rather than the `media` utility: `media > video` forces object-cover,
      // which would crop a 4:3 upload instead of letterboxing it.
      <div className="relative aspect-video w-full overflow-hidden rounded-card-lg bg-navy-dark shadow-e2">
        {embed ? (
          <iframe
            src={embed}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <video src={src} poster={poster ?? undefined} controls autoPlay playsInline className="absolute inset-0 h-full w-full object-contain" />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play the course video: ${title}`}
      className="ring-focus group tap-highlight-none relative block w-full cursor-pointer overflow-hidden rounded-card-lg shadow-e1 transition-shadow duration-element ease-soft hover:shadow-e2 motion-reduce:transition-none"
    >
      <span className="media media-16x9">
        {poster ? <SafeImage src={poster} alt="" sizes="(max-width: 1024px) 100vw, 720px" priority={priority} /> : <MediaPlaceholder seed={seed} tone="navy" />}
      </span>
      <span aria-hidden className="absolute inset-0 bg-navy-dark/35 transition-colors duration-element ease-soft group-hover:bg-navy-dark/45 motion-reduce:transition-none" />
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-orange shadow-e2 transition-transform duration-element ease-soft group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      >
        <Play className="ml-0.5 h-7 w-7 fill-current" />
      </span>
    </button>
  );
}

const YOUTUBE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/i;

/** Provider embed URL for a share link, or null when the URL is a plain media file. */
function embedUrl(src: string): string | null {
  const yt = YOUTUBE.exec(src);
  // youtube-nocookie: no tracking cookie is set unless the visitor actually watches.
  if (yt?.[1]) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1`;
  const vm = VIMEO.exec(src);
  if (vm?.[1]) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&dnt=1`;
  return null;
}
