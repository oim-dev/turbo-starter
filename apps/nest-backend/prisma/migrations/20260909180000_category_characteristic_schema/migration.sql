ALTER TABLE "Category"
  ADD COLUMN "characteristicSchema" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "characteristicSchemaVersion" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "Category_characteristicSchemaVersion_check"
    CHECK ("characteristicSchemaVersion" >= 0),
  ADD CONSTRAINT "Category_characteristicSchema_check"
    CHECK (CASE WHEN jsonb_typeof("characteristicSchema") = 'array'
      THEN jsonb_array_length("characteristicSchema") <= 30 ELSE FALSE END);
