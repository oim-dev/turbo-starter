CREATE TYPE "FileStatus" AS ENUM ('uploading', 'ready', 'expired');

CREATE TABLE "StoredFile" (
  "id" UUID NOT NULL,
  "publicId" VARCHAR(8) NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "folder" VARCHAR(255),
  "tags" TEXT[] NOT NULL,
  "status" "FileStatus" NOT NULL DEFAULT 'uploading',
  "contentType" VARCHAR(100) NOT NULL,
  "extension" VARCHAR(8) NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "currentVersion" INTEGER NOT NULL DEFAULT 0,
  "ownerId" UUID NOT NULL,
  "ownerName" VARCHAR(120) NOT NULL,
  "ownerLogin" VARCHAR(64) NOT NULL,
  "uploadExpiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoredFile_publicId_format" CHECK ("publicId" ~ '^[0-9A-Za-z]{8}$'),
  CONSTRAINT "StoredFile_byteSize_positive" CHECK ("byteSize" > 0),
  CONSTRAINT "StoredFile_ready_version" CHECK ("status" <> 'ready' OR ("currentVersion" > 0 AND "completedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "StoredFile_publicId_key" ON "StoredFile"("publicId");
CREATE INDEX "StoredFile_createdAt_id_idx" ON "StoredFile"("createdAt", "id");
CREATE INDEX "StoredFile_status_uploadExpiresAt_idx" ON "StoredFile"("status", "uploadExpiresAt");
CREATE INDEX "StoredFile_folder_idx" ON "StoredFile"("folder");
CREATE INDEX "StoredFile_tags_idx" ON "StoredFile" USING GIN ("tags");

CREATE TABLE "FileBlob" (
  "id" UUID PRIMARY KEY,
  "sha256" CHAR(64) NOT NULL UNIQUE CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  "byteSize" INTEGER NOT NULL CHECK ("byteSize" > 0),
  "extension" VARCHAR(8) NOT NULL,
  "objectKey" TEXT NOT NULL UNIQUE,
  "objectEtag" TEXT NOT NULL,
  "objectVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "FileVersion" (
  "id" UUID PRIMARY KEY,
  "fileId" UUID NOT NULL REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "number" INTEGER NOT NULL CHECK ("number" > 0),
  "filename" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(100) NOT NULL,
  "extension" VARCHAR(8) NOT NULL,
  "blobId" UUID NOT NULL REFERENCES "FileBlob"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "ownerId" UUID NOT NULL,
  "ownerName" VARCHAR(120) NOT NULL,
  "ownerLogin" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FileVersion_fileId_number_key" ON "FileVersion"("fileId", "number");
CREATE INDEX "FileVersion_blobId_idx" ON "FileVersion"("blobId");
CREATE TABLE "FileUpload" (
  "id" UUID PRIMARY KEY,
  "fileId" UUID NOT NULL REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "isNewFile" BOOLEAN NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(100) NOT NULL,
  "extension" VARCHAR(8) NOT NULL,
  "byteSize" INTEGER NOT NULL CHECK ("byteSize" > 0),
  "claimedSha256" CHAR(64) NOT NULL CHECK ("claimedSha256" ~ '^[0-9a-f]{64}$'),
  "ownerId" UUID NOT NULL,
  "ownerName" VARCHAR(120) NOT NULL,
  "ownerLogin" VARCHAR(64) NOT NULL,
  "stagingKey" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resultVersionId" UUID REFERENCES "FileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reused" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "FileUpload_expiresAt_idx" ON "FileUpload"("expiresAt");
CREATE INDEX "FileUpload_fileId_idx" ON "FileUpload"("fileId");
