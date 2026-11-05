ALTER TABLE "Dispute"
ADD COLUMN "assigneeId" UUID,
ADD COLUMN "assignmentVersion" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Dispute_assigneeId_resolvedAt_createdAt_id_idx"
ON "Dispute"("assigneeId", "resolvedAt", "createdAt", "id");

ALTER TABLE "Dispute"
ADD CONSTRAINT "Dispute_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "AdminUser"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
