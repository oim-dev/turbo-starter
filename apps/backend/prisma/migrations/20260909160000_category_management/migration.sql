BEGIN;

ALTER TABLE "Category" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Category" ADD CONSTRAINT "Category_version_check" CHECK ("version" >= 1);

CREATE INDEX "Category_name_id_idx" ON "Category"("name", "id");

COMMIT;
