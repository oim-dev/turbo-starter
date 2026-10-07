CREATE TYPE "ActPhotoAnalysisStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

CREATE TABLE "ActPhotoAnalysis" (
  "id" UUID NOT NULL,
  "bookingId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "handoverActId" UUID NOT NULL,
  "returnActId" UUID NOT NULL,
  "status" "ActPhotoAnalysisStatus" NOT NULL DEFAULT 'PROCESSING',
  "model" VARCHAR(160) NOT NULL,
  "promptVersion" INTEGER NOT NULL DEFAULT 1,
  "result" JSONB,
  "errorCode" TEXT,
  "deadlineAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "appliedActId" UUID,
  "appliedById" UUID,
  "appliedAt" TIMESTAMP(3),
  "appliedNotes" VARCHAR(2000),
  CONSTRAINT "ActPhotoAnalysis_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActPhotoAnalysis_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ActPhotoAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ActPhotoAnalysis_handoverActId_fkey" FOREIGN KEY ("handoverActId") REFERENCES "ActVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ActPhotoAnalysis_returnActId_fkey" FOREIGN KEY ("returnActId") REFERENCES "ActVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ActPhotoAnalysis_appliedActId_fkey" FOREIGN KEY ("appliedActId") REFERENCES "ActVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ActPhotoAnalysis_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ActPhotoAnalysis_application_complete" CHECK (
    ("appliedActId" IS NULL AND "appliedById" IS NULL AND "appliedAt" IS NULL AND "appliedNotes" IS NULL)
    OR ("appliedActId" IS NOT NULL AND "appliedById" IS NOT NULL AND "appliedAt" IS NOT NULL AND "appliedNotes" IS NOT NULL AND "status" = 'READY')
  )
);

CREATE UNIQUE INDEX "ActPhotoAnalysis_appliedActId_key" ON "ActPhotoAnalysis"("appliedActId");
CREATE UNIQUE INDEX "ActPhotoAnalysis_createdById_idempotencyKey_key" ON "ActPhotoAnalysis"("createdById", "idempotencyKey");
CREATE INDEX "ActPhotoAnalysis_bookingId_createdAt_id_idx" ON "ActPhotoAnalysis"("bookingId", "createdAt", "id");
CREATE INDEX "ActPhotoAnalysis_createdById_createdAt_idx" ON "ActPhotoAnalysis"("createdById", "createdAt");
