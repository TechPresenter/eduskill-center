-- AlterTable
ALTER TABLE "auth_challenges" ADD COLUMN     "code_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "code_sent_at" TIMESTAMP(3),
ADD COLUMN     "codes_sent" INTEGER NOT NULL DEFAULT 0;
