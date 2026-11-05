-- CreateEnum
CREATE TYPE "SessionTransport" AS ENUM ('BROWSER', 'MOBILE');

-- CreateTable
CREATE TABLE "ClientUser" (
    "id" UUID NOT NULL,
    "login" VARCHAR(64) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "login" VARCHAR(64) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "transport" "SessionTransport" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ClientSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRefreshToken" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "sessionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "ClientRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "transport" "SessionTransport" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRefreshToken" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "sessionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "AdminRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientUser_login_key" ON "ClientUser"("login");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_login_key" ON "AdminUser"("login");

-- CreateIndex
CREATE INDEX "ClientSession_userId_idx" ON "ClientSession"("userId");

-- CreateIndex
CREATE INDEX "ClientSession_expiresAt_idx" ON "ClientSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRefreshToken_tokenHash_key" ON "ClientRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientRefreshToken_sessionId_idx" ON "ClientRefreshToken"("sessionId");

-- CreateIndex
CREATE INDEX "AdminSession_userId_idx" ON "AdminSession"("userId");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRefreshToken_tokenHash_key" ON "AdminRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminRefreshToken_sessionId_idx" ON "AdminRefreshToken"("sessionId");

-- AddForeignKey
ALTER TABLE "ClientSession" ADD CONSTRAINT "ClientSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ClientUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRefreshToken" ADD CONSTRAINT "ClientRefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClientSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRefreshToken" ADD CONSTRAINT "AdminRefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdminSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
