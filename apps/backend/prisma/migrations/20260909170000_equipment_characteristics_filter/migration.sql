-- Поиск точных пар name/value через JSONB containment (@>).
CREATE INDEX "Equipment_characteristics_idx" ON "Equipment" USING GIN ("characteristics" jsonb_path_ops);
