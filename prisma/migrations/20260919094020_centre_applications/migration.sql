-- CreateEnum
CREATE TYPE "CentreApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_REQUIRED', 'DOCUMENTS_VERIFIED', 'CENTRE_VERIFICATION', 'SELECTED', 'AGREEMENT_PENDING', 'AGREEMENT_SIGNED', 'ORIENTATION', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CentreSpaceType" AS ENUM ('OWN', 'RENTED', 'COMMUNITY', 'OTHER');

-- CreateTable
CREATE TABLE "centre_applications" (
    "id" UUID NOT NULL,
    "application_no" TEXT NOT NULL,
    "applicant_name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT NOT NULL,
    "dob" DATE,
    "gender" "Gender",
    "photo_url" TEXT,
    "qualification" TEXT NOT NULL,
    "occupation" TEXT,
    "teaching_experience_years" INTEGER NOT NULL DEFAULT 0,
    "state_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "block_id" UUID NOT NULL,
    "village_town" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "proposed_name" TEXT NOT NULL,
    "space_type" "CentreSpaceType" NOT NULL DEFAULT 'OWN',
    "room_count" INTEGER NOT NULL DEFAULT 1,
    "area_sqft" INTEGER,
    "seating_capacity" INTEGER NOT NULL DEFAULT 0,
    "has_electricity" BOOLEAN NOT NULL DEFAULT false,
    "has_toilet" BOOLEAN NOT NULL DEFAULT false,
    "has_drinking_water" BOOLEAN NOT NULL DEFAULT false,
    "has_furniture" BOOLEAN NOT NULL DEFAULT false,
    "expected_students" INTEGER NOT NULL DEFAULT 0,
    "classes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "motivation" TEXT NOT NULL,
    "status" "CentreApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "review_notes" TEXT,
    "rejection_reason" TEXT,
    "verification_at" TIMESTAMP(3),
    "verification_notes" TEXT,
    "verified_by_id" UUID,
    "agreement_reference" TEXT,
    "agreement_signed_at" TIMESTAMP(3),
    "orientation_at" TIMESTAMP(3),
    "orientation_mode" TEXT,
    "reviewed_by_id" UUID,
    "center_id" UUID,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centre_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centre_application_documents" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" TEXT,
    "size" INTEGER,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "centre_application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centre_application_status_history" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "from_status" "CentreApplicationStatus",
    "to_status" "CentreApplicationStatus" NOT NULL,
    "note" TEXT,
    "changed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "centre_application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "centre_applications_application_no_key" ON "centre_applications"("application_no");

-- CreateIndex
CREATE UNIQUE INDEX "centre_applications_center_id_key" ON "centre_applications"("center_id");

-- CreateIndex
CREATE INDEX "centre_applications_status_submitted_at_idx" ON "centre_applications"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "centre_applications_state_id_district_id_block_id_idx" ON "centre_applications"("state_id", "district_id", "block_id");

-- CreateIndex
CREATE INDEX "centre_applications_email_idx" ON "centre_applications"("email");

-- CreateIndex
CREATE INDEX "centre_applications_mobile_idx" ON "centre_applications"("mobile");

-- CreateIndex
CREATE INDEX "centre_application_documents_application_id_idx" ON "centre_application_documents"("application_id");

-- CreateIndex
CREATE INDEX "centre_application_status_history_application_id_idx" ON "centre_application_status_history"("application_id");

-- AddForeignKey
ALTER TABLE "centre_applications" ADD CONSTRAINT "centre_applications_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centre_applications" ADD CONSTRAINT "centre_applications_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centre_applications" ADD CONSTRAINT "centre_applications_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centre_applications" ADD CONSTRAINT "centre_applications_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centre_application_documents" ADD CONSTRAINT "centre_application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "centre_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centre_application_status_history" ADD CONSTRAINT "centre_application_status_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "centre_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
