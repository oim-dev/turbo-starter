ALTER TABLE "AdminKeycloakSettings"
  ALTER COLUMN "issuer" SET DEFAULT 'https://route66.biocad.ru/realms/biocad',
  ALTER COLUMN "callbackUrl" SET DEFAULT 'http://localhost:3001/api/auth/callback',
  ALTER COLUMN "frontendCallbackUrl" SET DEFAULT 'http://localhost:3001/auth/keycloak/callback';

-- Начальная запись создана прежними миграциями с пустыми адресами и version=1.
-- Заполняем только эту конфигурацию; сохранённые настройки принадлежат владельцу.
UPDATE "AdminKeycloakSettings"
SET "issuer" = 'https://route66.biocad.ru/realms/biocad',
    "callbackUrl" = 'http://localhost:3001/api/auth/callback',
    "frontendCallbackUrl" = 'http://localhost:3001/auth/keycloak/callback',
    "version" = "version" + 1,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 1
  AND "version" = 1
  AND "enabled" = false
  AND "issuer" = ''
  AND "clientId" = ''
  AND "clientSecret" IS NULL
  AND "callbackUrl" = ''
  AND "frontendCallbackUrl" = '';
