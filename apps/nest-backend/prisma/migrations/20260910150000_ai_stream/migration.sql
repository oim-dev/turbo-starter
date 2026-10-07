ALTER TABLE "AiRequest"
    ADD COLUMN "blocks" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN "streamVersion" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "streamCursor" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "AiRequestEvent" (
    "requestId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRequestEvent_pkey" PRIMARY KEY ("requestId", "sequence"),
    CONSTRAINT "AiRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AiRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
