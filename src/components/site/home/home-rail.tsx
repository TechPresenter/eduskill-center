import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Carousel } from "@/components/ui/carousel";
import { SectionHeader } from "@/components/ui/list";

/**
 * A titled, swipeable row for the phone home screen ("Popular courses", "Training centres"): a section
 * header with a "See all" link, then a scroll-snap carousel whose next card always peeks in (1.3 per
 * view on phones, 2.3 on small tablets) so it is obvious the row scrolls. No arrows or dots — the swipe
 * is the browser's own gesture, and "See all" is the way to the full list.
 */
export function HomeRail({
  id,
  title,
  seeAllHref,
  seeAllLabel,
  children,
}: {
  id: string;
  title: string;
  seeAllHref: string;
  /** Full destination name for screen readers, e.g. "all courses". */
  seeAllLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <SectionHeader
        id={id}
        variant="title"
        title={title}
        action={
          /*
            Navy, not orange: "See all" is 13.5px text and orange measures 3.72 on white — under the
            4.5 a sentence-sized link owes. Navy is 8.49, and the hover step navy-light is still 5.82.
          */
          <Link
            href={seeAllHref}
            className="ring-focus -mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-navy transition-colors duration-micro tap-highlight-none hover:text-navy-light motion-reduce:transition-none"
          >
            See all<span className="sr-only"> {seeAllLabel}</span>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        }
      />
      <Carousel aria-label={title} slidesPerView={{ base: 1.3, sm: 2.3 }} gap={3} showArrows={false} showDots={false} className="mt-2" trackClassName="py-1">
        {children}
      </Carousel>
    </section>
  );
}
