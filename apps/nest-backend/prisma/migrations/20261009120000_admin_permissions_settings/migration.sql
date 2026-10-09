CREATE TABLE "AdminAccessRole" (
  "key" VARCHAR(64) PRIMARY KEY,
  "name" VARCHAR(120) NOT NULL,
  "permissions" TEXT[] NOT NULL,
  "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "AdminAccessRole" ("key", "name", "permissions", "isBuiltin") VALUES
 ('OWNER', 'Владелец', ARRAY[]::TEXT[], true),
 ('ADMIN', 'Администратор', ARRAY['account.read','account.update','account.login.change','account.password.change'], true),
 ('USER', 'Пользователь', ARRAY['account.read','account.update','account.login.change','account.password.change'], true),
 ('SUPPORT', 'Поддержка', ARRAY['account.read','account.password.change'], false);
ALTER TABLE "AdminUser" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "AdminUser" ALTER COLUMN "role" TYPE VARCHAR(64) USING "role"::TEXT;
ALTER TABLE "AdminUser" ALTER COLUMN "role" SET DEFAULT 'USER';
ALTER TABLE "AdminUser" ADD COLUMN "name" VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_role_fkey" FOREIGN KEY ("role") REFERENCES "AdminAccessRole"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP TYPE "AdminRole";
CREATE TABLE "AdminKeycloakSettings" (
  "id" INTEGER PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "issuer" VARCHAR(512) NOT NULL DEFAULT '',
  "clientId" VARCHAR(255) NOT NULL DEFAULT '',
  "encryptedSecret" TEXT,
  "callbackUrl" VARCHAR(2048) NOT NULL DEFAULT '',
  "frontendCallbackUrl" VARCHAR(2048) NOT NULL DEFAULT '',
  "sessionTtlSeconds" INTEGER NOT NULL DEFAULT 900,
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
INSERT INTO "AdminKeycloakSettings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP);
ALTER TABLE "AdminOidcTransaction" ADD COLUMN "configVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "AdminSecurityAudit" (
  "id" UUID PRIMARY KEY,
  "actorId" UUID NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "target" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
