-- AlterTable
ALTER TABLE "blogs" ADD COLUMN     "author_id" UUID,
ADD COLUMN     "canonical_url" TEXT,
ADD COLUMN     "category_id" UUID,
ADD COLUMN     "cover_image_alt" TEXT,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "no_index" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "og_image" TEXT,
ADD COLUMN     "reading_minutes" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "related_post_ids" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "word_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color_tone" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_authors" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "role" TEXT,
    "bio" TEXT,
    "avatar" TEXT,
    "email" TEXT,
    "linkedin_url" TEXT,
    "twitter_url" TEXT,
    "website_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_name_key" ON "blog_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE INDEX "blog_categories_is_active_sort_order_idx" ON "blog_categories"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "blog_authors_slug_key" ON "blog_authors"("slug");

-- CreateIndex
CREATE INDEX "blog_authors_is_active_sort_order_idx" ON "blog_authors"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "blog_tags_name_key" ON "blog_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blog_tags_slug_key" ON "blog_tags"("slug");

-- CreateIndex
CREATE INDEX "blog_tags_post_count_idx" ON "blog_tags"("post_count");

-- CreateIndex
CREATE INDEX "blogs_category_id_status_published_at_idx" ON "blogs"("category_id", "status", "published_at");

-- CreateIndex
CREATE INDEX "blogs_author_id_status_published_at_idx" ON "blogs"("author_id", "status", "published_at");

-- CreateIndex
CREATE INDEX "blogs_status_is_featured_published_at_idx" ON "blogs"("status", "is_featured", "published_at");

-- CreateIndex
CREATE INDEX "blogs_tags_idx" ON "blogs" USING GIN ("tags" array_ops);

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "blog_authors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────── Backfill (hand-written) ───────────────────────
-- Everything below is appended by hand so that a fresh `prisma migrate deploy`
-- lands with the same data shape the local database has. `@default(uuid(7))` is
-- generated client-side by Prisma, so these INSERTs must supply their own ids —
-- gen_random_uuid() is core PostgreSQL 13+, no extension needed.

-- 1. One BlogAuthor per distinct legacy byline, then point the posts at it.
--    Two different names can normalise to the same slug ("EduSkill Team" vs
--    "eduskill  team"), which would violate blog_authors_slug_key and abort the
--    whole migration, so the slug carries a row-number suffix from the second
--    collision onwards instead of trusting the data to be clean.
WITH bylines AS (
  SELECT DISTINCT btrim("author_name") AS name
  FROM "blogs"
  WHERE "author_name" IS NOT NULL AND btrim("author_name") <> ''
), slugged AS (
  SELECT name,
         COALESCE(
           NULLIF(regexp_replace(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'), ''),
           'author'
         ) AS base
  FROM bylines
), numbered AS (
  SELECT name, base, row_number() OVER (PARTITION BY base ORDER BY name) AS rn
  FROM slugged
)
INSERT INTO "blog_authors" ("id", "name", "slug", "is_active", "sort_order", "created_at", "updated_at")
SELECT gen_random_uuid(), name,
       CASE WHEN rn = 1 THEN base ELSE base || '-' || rn END,
       true, 0, now(), now()
FROM numbered;

UPDATE "blogs" b
SET "author_id" = a."id"
FROM "blog_authors" a
WHERE btrim(b."author_name") = a."name";

-- 2. Rough word count and reading time for the posts that predate the columns.
--    Any later save recomputes both precisely from the markdown; this only has to
--    be close enough that an existing post does not render "1 min read" forever.
UPDATE "blogs"
SET "word_count" = COALESCE(array_length(regexp_split_to_array(NULLIF(btrim("content"), ''), '\s+'), 1), 0);

UPDATE "blogs"
SET "reading_minutes" = GREATEST(1, CEIL("word_count" / 200.0)::int);

-- 3. Seed the tag lookup from the existing String[] values. blog_tags is a lookup
--    table, not a join table: "name" is the exact label stored inside blogs.tags,
--    so nothing about the arrays changes and existing ?tag= links keep resolving.
WITH labels AS (
  SELECT DISTINCT btrim(t.tag) AS name
  FROM "blogs" b, unnest(b."tags") AS t(tag)
  WHERE btrim(t.tag) <> ''
), slugged AS (
  SELECT name,
         COALESCE(
           NULLIF(regexp_replace(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'), ''),
           'tag'
         ) AS base
  FROM labels
), numbered AS (
  SELECT name, base, row_number() OVER (PARTITION BY base ORDER BY name) AS rn
  FROM slugged
)
INSERT INTO "blog_tags" ("id", "name", "slug", "post_count", "created_at", "updated_at")
SELECT gen_random_uuid(), name,
       CASE WHEN rn = 1 THEN base ELSE base || '-' || rn END,
       0, now(), now()
FROM numbered
ON CONFLICT ("name") DO NOTHING;

-- post_count counts LIVE posts only — published AND already past its date — so the
-- admin tag filter and the public tag cloud never advertise a scheduled post.
UPDATE "blog_tags" bt
SET "post_count" = (
  SELECT count(*) FROM "blogs" b
  WHERE b."status" = 'PUBLISHED'
    AND b."published_at" IS NOT NULL
    AND b."published_at" <= now()
    AND bt."name" = ANY(b."tags")
);
