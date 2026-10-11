-- Только расширение схемы: UUID, FK, оригиналы и варианты сохраняются.
ALTER TABLE "Image"
  ADD COLUMN "publicId" VARCHAR(8),
  ADD COLUMN "claimedSha256" CHAR(64),
  ADD COLUMN "originalSha256" CHAR(64),
  ADD COLUMN "canonicalId" UUID;
CREATE UNIQUE INDEX "Image_publicId_key" ON "Image"("publicId");

-- gen_random_uuid встроен в PostgreSQL >= 13. Первый байт целиком случаен;
-- rejection sampling исключает modulo bias. Расширения не требуются.
DO $$
DECLARE
  alphabet CONSTANT TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  row_id UUID;
  candidate TEXT;
  octet INTEGER;
BEGIN
  FOR row_id IN SELECT id FROM "Image" ORDER BY id LOOP
    LOOP
      candidate := '';
      WHILE length(candidate) < 8 LOOP
        octet := get_byte(uuid_send(gen_random_uuid()), 0);
        IF octet < 248 THEN
          candidate := candidate || substr(alphabet, octet % 62 + 1, 1);
        END IF;
      END LOOP;
      BEGIN
        UPDATE "Image" SET "publicId" = candidate WHERE id = row_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- Повтор только коллизии publicId; остальные данные не меняются.
        NULL;
      END;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE "Image" ALTER COLUMN "publicId" SET NOT NULL;
ALTER TABLE "Image"
  ADD CONSTRAINT "Image_publicId_format" CHECK ("publicId" ~ '^[0-9A-Za-z]{8}$'),
  ADD CONSTRAINT "Image_claimedSha256_format" CHECK ("claimedSha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "Image_originalSha256_format" CHECK ("originalSha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "Image_canonical_not_self" CHECK ("canonicalId" <> id),
  ADD CONSTRAINT "Image_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "Image"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Image_canonicalId_idx" ON "Image"("canonicalId");

CREATE TABLE "ImageHashClaim" (
  "scope" VARCHAR(43) NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "imageId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImageHashClaim_pkey" PRIMARY KEY ("scope", "sha256"),
  CONSTRAINT "ImageHashClaim_sha256_format" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ImageHashClaim_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ImageHashClaim_imageId_key" ON "ImageHashClaim"("imageId");
