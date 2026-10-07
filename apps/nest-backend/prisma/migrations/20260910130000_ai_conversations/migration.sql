ALTER TYPE "AiRequestStatus" ADD VALUE 'ANSWERED';

CREATE TABLE "AiConversation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ClientUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AiConversation_userId_updatedAt_id_idx" ON "AiConversation"("userId", "updatedAt", "id");

ALTER TABLE "AiRequest" ADD COLUMN "conversationId" UUID,
    ADD COLUMN "turn" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "input" JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN "recommendations" JSONB NOT NULL DEFAULT '[]';

-- Сохраняем существующие одиночные запросы как первые сообщения отдельных диалогов.
INSERT INTO "AiConversation" ("id", "userId", "title", "turnCount", "createdAt", "updatedAt")
SELECT "id", "userId", left("prompt", 160), 1, "createdAt", "updatedAt" FROM "AiRequest";
UPDATE "AiRequest" SET "conversationId" = "id",
    "input" = jsonb_build_object('city', "city", 'startDate', "startDate", 'endDate', "endDate");
ALTER TABLE "AiRequest" ALTER COLUMN "conversationId" SET NOT NULL;
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "AiRequest_conversationId_turn_key" ON "AiRequest"("conversationId", "turn");
