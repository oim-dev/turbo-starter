BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TYPE "EquipmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "PhotoPurpose" AS ENUM ('CATALOG', 'EVIDENCE');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'IN_USE', 'COMPLETED', 'DISPUTED');
CREATE TYPE "DepositStatus" AS ENUM ('NONE', 'HELD', 'RELEASED', 'PARTIALLY_WITHHELD', 'WITHHELD');
CREATE TYPE "ActType" AS ENUM ('HANDOVER', 'RETURN');
CREATE TYPE "DisputeResolution" AS ENUM ('CANCEL_BOOKING', 'COMPLETE_RETURN');
ALTER TABLE "ClientUser" ADD COLUMN "city" VARCHAR(120), ADD COLUMN "phone" VARCHAR(32);

CREATE TABLE "Category" (
  "id" UUID NOT NULL, "slug" VARCHAR(80) NOT NULL, "name" VARCHAR(120) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Equipment" (
  "id" UUID NOT NULL, "ownerId" UUID NOT NULL, "categoryId" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL, "description" VARCHAR(5000) NOT NULL, "city" VARCHAR(120) NOT NULL,
  "pricePerDay" INTEGER NOT NULL, "deposit" INTEGER NOT NULL,
  "characteristics" JSONB NOT NULL DEFAULT '[]', "checklist" TEXT[],
  "status" "EquipmentStatus" NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Equipment_money_check" CHECK ("pricePerDay" BETWEEN 1 AND 10000000 AND "deposit" BETWEEN 0 AND 1000000000)
);
CREATE TABLE "Photo" (
  "id" UUID NOT NULL, "ownerId" UUID NOT NULL, "purpose" "PhotoPurpose" NOT NULL, "key" TEXT NOT NULL,
  "contentType" VARCHAR(80) NOT NULL, "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "equipmentId" UUID,
  CONSTRAINT "Photo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Photo_purpose_check" CHECK ("equipmentId" IS NULL OR "purpose" = 'CATALOG')
);
CREATE TABLE "BookingGroup" (
  "id" UUID NOT NULL, "renterId" UUID NOT NULL, "idempotencyKey" UUID NOT NULL, "fingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingGroup_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Booking" (
  "id" UUID NOT NULL, "groupId" UUID NOT NULL, "equipmentId" UUID NOT NULL, "renterId" UUID NOT NULL, "ownerId" UUID NOT NULL,
  "equipmentName" VARCHAR(160) NOT NULL, "city" VARCHAR(120) NOT NULL, "checklist" TEXT[],
  "startDate" DATE NOT NULL, "endDate" DATE NOT NULL, "days" INTEGER NOT NULL,
  "pricePerDay" INTEGER NOT NULL, "totalPrice" INTEGER NOT NULL, "deposit" INTEGER NOT NULL,
  "depositStatus" "DepositStatus" NOT NULL DEFAULT 'NONE', "withheldAmount" INTEGER NOT NULL DEFAULT 0,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING', "issuedAt" TIMESTAMP(3), "returnedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Booking_parties_check" CHECK ("renterId" <> "ownerId"),
  CONSTRAINT "Booking_period_check" CHECK ("endDate" > "startDate" AND "days" = "endDate" - "startDate" AND "days" BETWEEN 1 AND 90),
  CONSTRAINT "Booking_money_check" CHECK ("pricePerDay" > 0 AND "totalPrice" = "days" * "pricePerDay" AND "deposit" >= 0 AND "withheldAmount" BETWEEN 0 AND "deposit")
);
CREATE TABLE "CalendarBlock" (
  "id" UUID NOT NULL, "equipmentId" UUID NOT NULL, "startDate" DATE NOT NULL, "endDate" DATE NOT NULL,
  "reason" VARCHAR(500) NOT NULL, "bookingId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarBlock_period_check" CHECK ("endDate" > "startDate"),
  CONSTRAINT "CalendarBlock_no_overlap" EXCLUDE USING gist ("equipmentId" WITH =, daterange("startDate", "endDate", '[)') WITH &&)
);
CREATE TABLE "BookingEvent" (
  "id" UUID NOT NULL, "bookingId" UUID NOT NULL, "actorId" UUID NOT NULL, "actorType" VARCHAR(16) NOT NULL,
  "action" VARCHAR(40) NOT NULL, "note" VARCHAR(2000) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ActVersion" (
  "id" UUID NOT NULL, "bookingId" UUID NOT NULL, "type" "ActType" NOT NULL, "version" INTEGER NOT NULL,
  "checklist" JSONB NOT NULL, "notes" VARCHAR(2000) NOT NULL, "createdById" UUID NOT NULL,
  "ownerSignedAt" TIMESTAMP(3), "renterSignedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Dispute" (
  "id" UUID NOT NULL, "bookingId" UUID NOT NULL, "openedById" UUID NOT NULL, "reason" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3), "resolvedById" UUID,
  "resolution" "DisputeResolution", "resolutionNote" VARCHAR(2000), "withheldAmount" INTEGER,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Review" (
  "id" UUID NOT NULL, "bookingId" UUID NOT NULL, "equipmentId" UUID NOT NULL, "rating" INTEGER NOT NULL,
  "comment" VARCHAR(2000) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id"), CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);
CREATE TABLE "_ActVersionToPhoto" ("A" UUID NOT NULL, "B" UUID NOT NULL, CONSTRAINT "_ActVersionToPhoto_AB_pkey" PRIMARY KEY ("A", "B"));
CREATE TABLE "_DisputeToPhoto" ("A" UUID NOT NULL, "B" UUID NOT NULL, CONSTRAINT "_DisputeToPhoto_AB_pkey" PRIMARY KEY ("A", "B"));

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Equipment_ownerId_status_idx" ON "Equipment"("ownerId", "status");
CREATE INDEX "Equipment_status_categoryId_city_pricePerDay_idx" ON "Equipment"("status", "categoryId", "city", "pricePerDay");
CREATE UNIQUE INDEX "Photo_key_key" ON "Photo"("key");
CREATE INDEX "Photo_ownerId_idx" ON "Photo"("ownerId");
CREATE INDEX "Photo_equipmentId_idx" ON "Photo"("equipmentId");
CREATE UNIQUE INDEX "BookingGroup_renterId_idempotencyKey_key" ON "BookingGroup"("renterId", "idempotencyKey");
CREATE INDEX "Booking_renterId_status_createdAt_idx" ON "Booking"("renterId", "status", "createdAt");
CREATE INDEX "Booking_ownerId_status_createdAt_idx" ON "Booking"("ownerId", "status", "createdAt");
CREATE INDEX "Booking_equipmentId_startDate_endDate_idx" ON "Booking"("equipmentId", "startDate", "endDate");
CREATE INDEX "Booking_groupId_idx" ON "Booking"("groupId");
CREATE UNIQUE INDEX "CalendarBlock_bookingId_key" ON "CalendarBlock"("bookingId");
CREATE INDEX "CalendarBlock_equipmentId_startDate_endDate_idx" ON "CalendarBlock"("equipmentId", "startDate", "endDate");
CREATE INDEX "BookingEvent_bookingId_createdAt_idx" ON "BookingEvent"("bookingId", "createdAt");
CREATE UNIQUE INDEX "ActVersion_bookingId_type_version_key" ON "ActVersion"("bookingId", "type", "version");
CREATE UNIQUE INDEX "Dispute_bookingId_key" ON "Dispute"("bookingId");
CREATE INDEX "Dispute_resolvedAt_createdAt_idx" ON "Dispute"("resolvedAt", "createdAt");
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");
CREATE INDEX "Review_equipmentId_createdAt_idx" ON "Review"("equipmentId", "createdAt");
CREATE INDEX "_ActVersionToPhoto_B_index" ON "_ActVersionToPhoto"("B");
CREATE INDEX "_DisputeToPhoto_B_index" ON "_DisputeToPhoto"("B");

ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BookingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActVersion" ADD CONSTRAINT "ActVersion_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "_ActVersionToPhoto" ADD CONSTRAINT "_ActVersionToPhoto_A_fkey" FOREIGN KEY ("A") REFERENCES "ActVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ActVersionToPhoto" ADD CONSTRAINT "_ActVersionToPhoto_B_fkey" FOREIGN KEY ("B") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DisputeToPhoto" ADD CONSTRAINT "_DisputeToPhoto_A_fkey" FOREIGN KEY ("A") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DisputeToPhoto" ADD CONSTRAINT "_DisputeToPhoto_B_fkey" FOREIGN KEY ("B") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
