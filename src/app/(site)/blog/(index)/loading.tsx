import { Skeleton } from "@/components/ui/feedback";
import { PageHero } from "@/components/site/page-hero";
import { SectionBg } from "@/components/site/decor";

/**
 * The blog index while its data is in flight.
 *
 * WHY IT EXISTS: every filter on `/blog` is a real navigation — the search form is a GET form, the
 * category chips are links and pagination is links — so each one costs a server round trip. Without
 * this, tapping a chip on a phone left the reader on the old page with nothing happening until the
 * new HTML arrived. The hero is rendered for real (its copy is static), so only the part that is
 * actually loading is greyed out and the page does not jump when the content lands.
 *
 * WHY IT LIVES IN A `(index)` ROUTE GROUP — do not move it back up to `blog/`.
 * A `loading.tsx` opens a Suspense boundary for its segment AND every segment nested under it, and
 * streaming that boundary commits the HTTP status before the page body runs. Sitting at `blog/`,
 * this file silently turned every `notFound()` beneath it into a soft 404: a missing slug, a
 * deleted category and — worst of all — a DRAFT or SCHEDULED post all answered `200 OK` with a
 * "Post not found" body. Crawlers index those as real pages, which quietly defeats the whole
 * scheduling feature. The route group scopes the boundary to the index alone (route groups do not
 * appear in the URL, so this file still serves `/blog`), and the dynamic routes below it now
 * answer a true 404. Verified: `/blog` 200, `/blog/<draft>` 404, `/blog/<scheduled>` 404,
 * `/blog/category/<missing>` 404.
 *
 * The skeleton mirrors `PostCard`: a 16:9 cover, a meta line, a title, two lines of excerpt and a
 * tag row, at the same `md:grid-cols-2 lg:grid-cols-3` rhythm — a card of the wrong shape is worse
 * than no card, because the layout visibly rearranges itself on arrival.
 */
export default function Loading() {
  return (
    <>
      <PageHero compact eyebrow="Blog" title="News, Stories & [[Insights]]" description="Updates from our centers, trainers and students across India." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Blog" }]} />

      <section className="relative overflow-x-clip bg-surface section-y" aria-busy="true">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10">
          {/* Announced once, for a screen reader that would otherwise hear nothing change. Every
              decorative bar below is `aria-hidden` inside `Skeleton`. */}
          <p className="sr-only" role="status">
            Loading posts
          </p>

          {/* Search row: input + button, at the real control heights so nothing shifts. */}
          <div className="flex w-full max-w-xl items-center gap-2">
            <Skeleton className="h-11 flex-1 rounded-md sm:h-10" />
            <Skeleton className="h-11 w-24 shrink-0 rounded-md sm:h-10" />
          </div>

          {/* Category chips. `overflow-hidden` rather than `hscroll`: a placeholder must never be
              able to add a scrollbar (or widen the document) for a row that cannot be scrolled. */}
          <div className="mt-6 flex gap-2 overflow-hidden">
            {["w-24", "w-32", "w-28", "w-36", "w-24"].map((w, i) => (
              <Skeleton key={i} className={`h-11 shrink-0 rounded-full ${w}`} />
            ))}
          </div>

          <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i}>
                <PostCardSkeleton />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function PostCardSkeleton() {
  return (
    <div className="card flex h-full flex-col overflow-hidden">
      {/* The card's own aspect box rather than the `media` utility: `media` paints a lavender
          background that would fight the skeleton's grey, and there is no image to contain. */}
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="flex flex-1 flex-col card-p">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="mt-3 h-5 w-11/12" />
        <Skeleton className="mt-2 h-5 w-3/4" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-5/6" />
        <div className="mt-6 flex gap-1.5 border-t border-line pt-4">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}
