-- Admin-only extension. Existing local accounts/passwords and all Client models are preserved.
ALTER TABLE "AdminUser"
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "authValidAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "AdminIdentity" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "issuer" VARCHAR(512) NOT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AdminIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminIdentity_issuer_subject_key" ON "AdminIdentity"("issuer", "subject");
CREATE INDEX "AdminIdentity_userId_idx" ON "AdminIdentity"("userId");
ALTER TABLE "AdminIdentity" ADD CONSTRAINT "AdminIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminSession" ADD COLUMN "identityId" UUID;
CREATE INDEX "AdminSession_identityId_idx" ON "AdminSession"("identityId");
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "AdminIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdminOidcTransaction" (
  "stateHash" CHAR(64) NOT NULL,
  "browserHash" CHAR(64) NOT NULL,
  "codeVerifier" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "issuer" VARCHAR(512) NOT NULL,
  "clientId" VARCHAR(255) NOT NULL,
  "callbackUrl" VARCHAR(2048) NOT NULL,
  "returnTo" VARCHAR(2048) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "AdminOidcTransaction_pkey" PRIMARY KEY ("stateHash")
);
CREATE INDEX "AdminOidcTransaction_browserHash_idx" ON "AdminOidcTransaction"("browserHash");
CREATE INDEX "AdminOidcTransaction_expiresAt_idx" ON "AdminOidcTransaction"("expiresAt");

CREATE TABLE "AdminOidcCompletion" (
  "tokenHash" CHAR(64) NOT NULL,
  "transactionId" CHAR(64) NOT NULL,
  "identityId" UUID NOT NULL,
  "authVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "AdminOidcCompletion_pkey" PRIMARY KEY ("tokenHash")
);
CREATE UNIQUE INDEX "AdminOidcCompletion_transactionId_key" ON "AdminOidcCompletion"("transactionId");
CREATE INDEX "AdminOidcCompletion_identityId_idx" ON "AdminOidcCompletion"("identityId");
CREATE INDEX "AdminOidcCompletion_expiresAt_idx" ON "AdminOidcCompletion"("expiresAt");
ALTER TABLE "AdminOidcCompletion" ADD CONSTRAINT "AdminOidcCompletion_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "AdminOidcTransaction"("stateHash") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminOidcCompletion" ADD CONSTRAINT "AdminOidcCompletion_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "AdminIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
