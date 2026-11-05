CREATE TYPE "AiConfirmationChannel" AS ENUM ('BUTTON', 'CHAT');

ALTER TABLE "AiRequest"
  ADD COLUMN "confirmationChannel" "AiConfirmationChannel",
  ADD COLUMN "confirmedByRequestId" UUID,
  ADD COLUMN "proposalRequestId" UUID;

UPDATE "AiRequest" SET "confirmationChannel" = 'BUTTON' WHERE "status" = 'CONFIRMED';

CREATE UNIQUE INDEX "AiRequest_confirmedByRequestId_key" ON "AiRequest"("confirmedByRequestId");
CREATE INDEX "AiRequest_proposalRequestId_idx" ON "AiRequest"("proposalRequestId");

ALTER TABLE "AiRequest"
  ADD CONSTRAINT "AiRequest_confirmedByRequestId_fkey" FOREIGN KEY ("confirmedByRequestId") REFERENCES "AiRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AiRequest_proposalRequestId_fkey" FOREIGN KEY ("proposalRequestId") REFERENCES "AiRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AiRequest_confirmation_not_self" CHECK ("confirmedByRequestId" IS DISTINCT FROM "id" AND "proposalRequestId" IS DISTINCT FROM "id");
