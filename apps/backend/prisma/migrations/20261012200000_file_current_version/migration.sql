-- Имя постоянного URL принадлежит документу, а не выбранной версии.
ALTER TABLE "StoredFile" ADD COLUMN "publicFilename" VARCHAR(255);
UPDATE "StoredFile" f
SET "publicFilename" = COALESCE(
  (SELECT v.filename FROM "FileVersion" v WHERE v."fileId" = f.id AND v.number = 1),
  f.filename
);
ALTER TABLE "StoredFile" ALTER COLUMN "publicFilename" SET NOT NULL;

-- Сохраняем текущую публикацию; номер следующей версии определяется историей.
ALTER TABLE "StoredFile" ADD COLUMN "currentVersionId" UUID;
UPDATE "StoredFile" f
SET "currentVersionId" = v.id
FROM "FileVersion" v
WHERE v."fileId" = f.id AND v.number = f."currentVersion";

ALTER TABLE "StoredFile" DROP CONSTRAINT "StoredFile_ready_version";
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_ready_version"
  CHECK ("status" <> 'ready' OR ("currentVersionId" IS NOT NULL AND "completedAt" IS NOT NULL));
CREATE UNIQUE INDEX "StoredFile_currentVersionId_key" ON "StoredFile"("currentVersionId");
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_currentVersionId_fkey"
  FOREIGN KEY ("currentVersionId") REFERENCES "FileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoredFile" DROP COLUMN "currentVersion";
