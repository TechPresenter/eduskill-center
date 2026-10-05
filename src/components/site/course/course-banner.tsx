import { Media } from "@/components/site/safe-image";
import { CoursePromoVideo } from "@/components/site/course/course-video";

/**
 * Course Banner — the first thing under the title band.
 *
 * The promo video wins the slot when there is one (with the video thumbnail, the banner or the
 * course cover as its poster, in that order); otherwise the banner image fills it. Rendered only
 * when the Foundation has configured at least one of them, so a course with no media starts
 * straight at the overview instead of showing an empty frame.
 *
 * The inner `-mt-*` is deliberate: `PageHero` grows a bottom "shoulder" on phones when the next
 * section pulls up into it, so this banner overlaps the navy band by design on every width.
 */
export function CourseBanner({
  title,
  seed,
  bannerSrc,
  videoSrc,
  posterSrc,
}: {
  title: string;
  seed: string;
  bannerSrc: string | null;
  videoSrc: string | null;
  posterSrc: string | null;
}) {
  if (!bannerSrc && !videoSrc) return null;

  return (
    <section className="bg-white pb-8 lg:pb-14" aria-label={`${title} — course banner`}>
      <div className="container-x relative z-10 -mt-6 lg:-mt-14">
        {videoSrc ? (
          <CoursePromoVideo src={videoSrc} poster={posterSrc} title={title} seed={seed} priority />
        ) : (
          <div className="overflow-hidden rounded-card-lg shadow-e1">
            <Media src={bannerSrc} alt={title} seed={seed} ratio="16x9" sizes="(max-width: 1024px) 100vw, 1152px" priority />
          </div>
        )}
      </div>
    </section>
  );
}
