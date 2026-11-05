CREATE TYPE "AiRequestStatus" AS ENUM ('PROCESSING', 'NEEDS_INPUT', 'NO_MATCH', 'REFUSED', 'READY', 'FAILED', 'CONFIRMED');

CREATE TABLE "AiRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "prompt" VARCHAR(2000) NOT NULL,
    "city" VARCHAR(120),
    "startDate" VARCHAR(10),
    "endDate" VARCHAR(10),
    "status" "AiRequestStatus" NOT NULL DEFAULT 'PROCESSING',
    "model" VARCHAR(160) NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "missingFields" TEXT[] NOT NULL,
    "proposal" JSONB,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "errorCode" TEXT,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "bookingKey" UUID NOT NULL,
    "bookingGroupId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AiRequest_bookingGroupId_fkey" FOREIGN KEY ("bookingGroupId") REFERENCES "BookingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AiRequest_userId_idempotencyKey_key" ON "AiRequest"("userId", "idempotencyKey");
CREATE UNIQUE INDEX "AiRequest_bookingKey_key" ON "AiRequest"("bookingKey");
CREATE UNIQUE INDEX "AiRequest_bookingGroupId_key" ON "AiRequest"("bookingGroupId");
CREATE INDEX "AiRequest_userId_createdAt_id_idx" ON "AiRequest"("userId", "createdAt", "id");
