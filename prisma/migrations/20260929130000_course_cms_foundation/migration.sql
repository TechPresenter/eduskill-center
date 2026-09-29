-- CreateEnum
CREATE TYPE "CourseNodeKind" AS ENUM ('MODULE', 'CHAPTER', 'TOPIC', 'LESSON');

-- CreateEnum
CREATE TYPE "CourseFeeType" AS ENUM ('FREE', 'ONE_TIME', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CourseMediaKind" AS ENUM ('GALLERY', 'PROMOTIONAL');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "banner_image" TEXT,
ADD COLUMN     "instructor_image" TEXT,
ADD COLUMN     "promo_video_url" TEXT,
ADD COLUMN     "video_thumbnail" TEXT;

-- CreateTable
CREATE TABLE "course_nodes" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "parent_id" UUID,
    "kind" "CourseNodeKind" NOT NULL DEFAULT 'MODULE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "video_url" TEXT,
    "document_url" TEXT,
    "study_material_url" TEXT,
    "duration_text" TEXT,
    "duration_minutes" INTEGER,
    "is_free_preview" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "course_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_fee_plans" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "fee_type" "CourseFeeType" NOT NULL DEFAULT 'ONE_TIME',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "base_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discounted_fee" DECIMAL(12,2),
    "offer_price" DECIMAL(12,2),
    "enrolment_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_required" BOOLEAN NOT NULL DEFAULT true,
    "custom_label" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "course_fee_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_offers" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "discount_percent" INTEGER,
    "original_price" DECIMAL(12,2),
    "offer_price" DECIMAL(12,2),
    "coupon_code" TEXT,
    "banner_image" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "course_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_faqs" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "course_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_media" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "kind" "CourseMediaKind" NOT NULL DEFAULT 'GALLERY',
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "course_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_nodes_course_id_parent_id_sort_order_idx" ON "course_nodes"("course_id", "parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "course_nodes_parent_id_idx" ON "course_nodes"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_fee_plans_course_id_key" ON "course_fee_plans"("course_id");

-- CreateIndex
CREATE INDEX "course_offers_course_id_is_active_starts_at_ends_at_idx" ON "course_offers"("course_id", "is_active", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "course_faqs_course_id_sort_order_idx" ON "course_faqs"("course_id", "sort_order");

-- CreateIndex
CREATE INDEX "course_media_course_id_kind_sort_order_idx" ON "course_media"("course_id", "kind", "sort_order");

-- AddForeignKey
ALTER TABLE "course_nodes" ADD CONSTRAINT "course_nodes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_nodes" ADD CONSTRAINT "course_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "course_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_fee_plans" ADD CONSTRAINT "course_fee_plans_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offers" ADD CONSTRAINT "course_offers_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_faqs" ADD CONSTRAINT "course_faqs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_media" ADD CONSTRAINT "course_media_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
