-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('STUDENT_LOGIN', 'ADMIN_LOGIN', 'EMAIL_CHANGE');

-- AlterTable
ALTER TABLE "login_history" ADD COLUMN     "device_id_hash" TEXT,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "new_device" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspicious" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "login_otps" ADD COLUMN     "challenge_id" UUID,
ADD COLUMN     "purpose" "OtpPurpose" NOT NULL DEFAULT 'STUDENT_LOGIN',
ADD COLUMN     "target" TEXT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "auth_method" TEXT,
ADD COLUMN     "device_id_hash" TEXT,
ADD COLUMN     "mfa_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfa_failed_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mfa_locked_until" TIMESTAMP(3),
ADD COLUMN     "totp_enabled_at" TIMESTAMP(3),
ADD COLUMN     "totp_last_step" INTEGER,
ADD COLUMN     "totp_pending_at" TIMESTAMP(3),
ADD COLUMN     "totp_pending_secret_enc" TEXT,
ADD COLUMN     "totp_secret_enc" TEXT;

-- CreateTable
CREATE TABLE "auth_challenges" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID,
    "purpose" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "first_factor" TEXT,
    "email_hash" TEXT,
    "email_hint" TEXT,
    "next" TEXT,
    "pending_secret_enc" TEXT,
    "secret_shown_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_backup_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_id" UUID,

    CONSTRAINT "security_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_challenges_token_hash_key" ON "auth_challenges"("token_hash");

-- CreateIndex
CREATE INDEX "auth_challenges_user_id_idx" ON "auth_challenges"("user_id");

-- CreateIndex
CREATE INDEX "auth_challenges_expires_at_idx" ON "auth_challenges"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_backup_codes_code_hash_key" ON "two_factor_backup_codes"("code_hash");

-- CreateIndex
CREATE INDEX "two_factor_backup_codes_user_id_idx" ON "two_factor_backup_codes"("user_id");

-- CreateIndex
CREATE INDEX "security_alerts_created_at_idx" ON "security_alerts"("created_at");

-- CreateIndex
CREATE INDEX "security_alerts_acknowledged_at_idx" ON "security_alerts"("acknowledged_at");

-- CreateIndex
CREATE INDEX "security_alerts_user_id_idx" ON "security_alerts"("user_id");

-- CreateIndex
CREATE INDEX "login_otps_challenge_id_idx" ON "login_otps"("challenge_id");

-- AddForeignKey
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
