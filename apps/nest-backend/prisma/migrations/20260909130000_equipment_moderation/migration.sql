ALTER TABLE "Equipment"
ADD COLUMN "hiddenAt" TIMESTAMP(3),
ADD COLUMN "hiddenById" UUID,
ADD COLUMN "hiddenReason" VARCHAR(2000);

ALTER TABLE "Equipment"
ADD CONSTRAINT "Equipment_hiddenById_fkey"
FOREIGN KEY ("hiddenById") REFERENCES "AdminUser"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Equipment"
ADD CONSTRAINT "Equipment_moderation_check" CHECK (
  ("hiddenAt" IS NULL AND "hiddenById" IS NULL AND "hiddenReason" IS NULL)
  OR
  ("hiddenAt" IS NOT NULL AND "hiddenById" IS NOT NULL AND "hiddenReason" IS NOT NULL
    AND "hiddenReason" ~ '[^[:space:]]')
);

CREATE INDEX "Equipment_createdAt_id_idx" ON "Equipment"("createdAt", "id");
CREATE INDEX "Equipment_hiddenAt_createdAt_id_idx" ON "Equipment"("hiddenAt", "createdAt", "id");
CREATE INDEX "Equipment_hiddenById_idx" ON "Equipment"("hiddenById");
