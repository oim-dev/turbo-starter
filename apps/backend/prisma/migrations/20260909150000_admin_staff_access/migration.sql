CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'SUPPORT');
CREATE TYPE "AdminAccessAction" AS ENUM ('STAFF_CREATED', 'STAFF_ACCESS_CHANGED');

-- Сохраняем полномочия существующих аккаунтов. Новая запись без явной роли
-- получает SUPPORT; bootstrap/CLI явно создаёт владельца.
ALTER TABLE "AdminUser"
  ADD COLUMN "role" "AdminRole" NOT NULL DEFAULT 'OWNER',
  ADD COLUMN "accessVersion" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "AdminUser_accessVersion_check" CHECK ("accessVersion" >= 0);
ALTER TABLE "AdminUser" ALTER COLUMN "role" SET DEFAULT 'SUPPORT';
CREATE INDEX "AdminUser_role_isActive_idx" ON "AdminUser"("role", "isActive");

CREATE TABLE "AdminAccessEvent" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "actorId" UUID,
  "action" "AdminAccessAction" NOT NULL,
  "previousRole" "AdminRole",
  "previousIsActive" BOOLEAN,
  "role" "AdminRole" NOT NULL,
  "isActive" BOOLEAN NOT NULL,
  "version" INTEGER NOT NULL,
  "reason" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAccessEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminAccessEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdminAccessEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdminAccessEvent_version_check" CHECK ("version" > 0),
  CONSTRAINT "AdminAccessEvent_reason_check" CHECK ("reason" ~ '[^[:space:]]'),
  CONSTRAINT "AdminAccessEvent_transition_check" CHECK (
    ("action" = 'STAFF_CREATED' AND "version" = 1 AND "previousRole" IS NULL AND "previousIsActive" IS NULL)
    OR
    ("action" = 'STAFF_ACCESS_CHANGED' AND "actorId" IS NOT NULL
      AND "previousRole" IS NOT NULL AND "previousIsActive" IS NOT NULL
      AND ("previousRole" <> "role" OR "previousIsActive" <> "isActive"))
  )
);
CREATE UNIQUE INDEX "AdminAccessEvent_userId_version_key" ON "AdminAccessEvent"("userId", "version");
CREATE INDEX "AdminAccessEvent_actorId_createdAt_id_idx" ON "AdminAccessEvent"("actorId", "createdAt", "id");
