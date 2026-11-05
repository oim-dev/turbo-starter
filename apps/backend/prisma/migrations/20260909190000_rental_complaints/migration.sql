CREATE TYPE "ComplaintResolution" AS ENUM ('UPHELD', 'DISMISSED');

CREATE TABLE "Complaint" (
  "id" UUID NOT NULL,
  "bookingId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "reason" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" UUID,
  "resolution" "ComplaintResolution",
  "resolutionNote" VARCHAR(2000),

  CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Complaint_reason_check" CHECK ("reason" ~ '[^[:space:]]'),
  CONSTRAINT "Complaint_resolution_check" CHECK (
    ("resolvedAt" IS NULL AND "resolvedById" IS NULL AND "resolution" IS NULL AND "resolutionNote" IS NULL)
    OR
    ("resolvedAt" IS NOT NULL AND "resolvedById" IS NOT NULL AND "resolution" IS NOT NULL
      AND "resolutionNote" IS NOT NULL AND "resolutionNote" ~ '[^[:space:]]'
      AND "resolvedAt" >= "createdAt")
  )
);

CREATE UNIQUE INDEX "Complaint_bookingId_authorId_key" ON "Complaint"("bookingId", "authorId");
CREATE INDEX "Complaint_resolvedAt_createdAt_id_idx" ON "Complaint"("resolvedAt", "createdAt", "id");
CREATE INDEX "Complaint_authorId_createdAt_id_idx" ON "Complaint"("authorId", "createdAt", "id");
CREATE INDEX "Complaint_resolvedById_idx" ON "Complaint"("resolvedById");

ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
