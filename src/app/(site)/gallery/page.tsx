import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getBranding } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { PageHero } from "@/components/site/page-hero";
import { GalleryGrid, type GalleryImage } from "@/components/site/gallery-grid";
import { Reveal } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { JsonLd } from "@/components/site/json-ld";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding();
  const title = "Gallery";
  const description = `Photos from ${b.siteName} training centers, classrooms, events and community programs across India.`;
  return { title, description, alternates: { canonical: absoluteUrl("/gallery") }, openGraph: { title, description, url: absoluteUrl("/gallery"), type: "website" } };
}

export default async function GalleryPage() {
  const rows = await db.galleryItem.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, imageUrl: true, category: true, center: { select: { name: true } } },
  });
  const items: GalleryImage[] = rows.map((r) => ({ id: r.id, title: r.title, imageUrl: r.imageUrl, category: r.category, centerName: r.center?.name ?? null }));
  const categories = new Set(items.map((i) => i.category?.trim()).filter(Boolean));

  return (
    <>
      {items.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ImageGallery",
            name: "Gallery",
            url: absoluteUrl("/gallery"),
            image: items.slice(0, 50).map((i) => ({ "@type": "ImageObject", contentUrl: i.imageUrl.startsWith("http") ? i.imageUrl : absoluteUrl(i.imageUrl), name: i.title ?? undefined })),
          }}
        />
      )}
      <PageHero compact eyebrow="Gallery" title="Moments from Our [[Centers]]" description="Classrooms, practical sessions, certificate ceremonies and community events – real photos from EduSkill training centers." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Gallery" }]} />

      <section className="bg-white py-14 sm:py-20" aria-labelledby="gallery-title">
        <div className="container-x">
          <h2 id="gallery-title" className="sr-only">
            Photo gallery
          </h2>
          {items.length > 0 && (
            <p className="mb-6 text-sm text-muted" aria-live="polite">
              <span className="font-semibold text-navy">{items.length}</span> photo{items.length === 1 ? "" : "s"}
              {categories.size > 1 ? ` across ${categories.size} categories` : ""}. Select a photo to view it full size.
            </p>
          )}
          <Reveal>
            <GalleryGrid items={items} />
          </Reveal>
        </div>
      </section>

      <CtaBand title="See it for [[yourself]]" description="Visit the training center closest to you, meet the trainers and sit in on a class before you apply." primary={{ label: "Find a Training Center", href: "/training-centers" }} secondary={{ label: "Upcoming Events", href: "/events" }} />
    </>
  );
}
