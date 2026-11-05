ALTER TABLE "Review"
ADD COLUMN "hiddenAt" TIMESTAMP(3),
ADD COLUMN "hiddenById" UUID,
ADD COLUMN "hiddenReason" VARCHAR(2000);

ALTER TABLE "Review"
ADD CONSTRAINT "Review_hiddenById_fkey"
FOREIGN KEY ("hiddenById") REFERENCES "AdminUser"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review"
ADD CONSTRAINT "Review_moderation_check" CHECK (
  ("hiddenAt" IS NULL AND "hiddenById" IS NULL AND "hiddenReason" IS NULL)
  OR
  ("hiddenAt" IS NOT NULL AND "hiddenById" IS NOT NULL AND "hiddenReason" IS NOT NULL
    AND "hiddenReason" ~ '[^[:space:]]')
);

CREATE INDEX "Review_createdAt_id_idx" ON "Review"("createdAt", "id");
CREATE INDEX "Review_hiddenAt_createdAt_id_idx" ON "Review"("hiddenAt", "createdAt", "id");
CREATE INDEX "Review_hiddenById_idx" ON "Review"("hiddenById");
