-- Старый secret зашифрован внешним ключом: его нужно повторно задать через UI.
ALTER TABLE "AdminKeycloakSettings" ADD COLUMN "clientSecret" TEXT;

UPDATE "AdminKeycloakSettings"
SET "enabled" = false, "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP;

DELETE FROM "AdminOidcTransaction";

UPDATE "AdminSession"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "identityId" IS NOT NULL AND "revokedAt" IS NULL;

ALTER TABLE "AdminKeycloakSettings" DROP COLUMN "encryptedSecret";
