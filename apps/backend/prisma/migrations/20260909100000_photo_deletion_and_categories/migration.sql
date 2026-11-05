BEGIN;
ALTER TABLE "Photo" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Справочник нужен и в production, где демонстрационный seed запрещён.
INSERT INTO "Category" ("id", "slug", "name") VALUES
  ('10000000-0000-4000-8000-000000000001', 'construction', 'Строительная техника'),
  ('10000000-0000-4000-8000-000000000002', 'garden', 'Садовая техника'),
  ('10000000-0000-4000-8000-000000000003', 'cleaning', 'Уборка и уход')
ON CONFLICT ("slug") DO NOTHING;
COMMIT;
