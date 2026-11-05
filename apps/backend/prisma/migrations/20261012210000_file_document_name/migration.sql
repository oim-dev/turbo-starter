-- Сохраняем заданное пользователем название; имя версии остаётся в FileVersion.
-- Пустое название означает первоначальное имя постоянной ссылки.
UPDATE "StoredFile"
SET "filename" = COALESCE(NULLIF(BTRIM("title"), ''), "publicFilename"),
    "publicFilename" = COALESCE(NULLIF(BTRIM("title"), ''), "publicFilename"),
    "title" = COALESCE(NULLIF(BTRIM("title"), ''), "publicFilename"),
    "updatedAt" = CURRENT_TIMESTAMP;
