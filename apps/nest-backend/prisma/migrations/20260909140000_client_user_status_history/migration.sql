ALTER TABLE "ClientUser" ADD COLUMN "statusVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ClientUser" ADD CONSTRAINT "ClientUser_statusVersion_check"
  CHECK ("statusVersion" >= 0);

CREATE TABLE "ClientUserStatusEvent" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "isActive" BOOLEAN NOT NULL,
  "version" INTEGER NOT NULL,
  "reason" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientUserStatusEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientUserStatusEvent_version_check" CHECK ("version" > 0),
  CONSTRAINT "ClientUserStatusEvent_reason_check" CHECK ("reason" ~ '[^[:space:]]'),
  CONSTRAINT "ClientUserStatusEvent_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClientUserStatusEvent_actorId_fkey" FOREIGN KEY ("actorId")
    REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClientUserStatusEvent_userId_version_key"
  ON "ClientUserStatusEvent"("userId", "version");
CREATE INDEX "ClientUserStatusEvent_actorId_createdAt_id_idx"
  ON "ClientUserStatusEvent"("actorId", "createdAt", "id");
