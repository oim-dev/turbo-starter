-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('uploading', 'queued', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "ImageRealm" AS ENUM ('admin', 'client');

-- CreateEnum
CREATE TYPE "ImagePreset" AS ENUM ('original', 'square', 'landscape');

-- CreateEnum
CREATE TYPE "ImageJobStatus" AS ENUM ('queued', 'processing', 'ready', 'failed');

-- CreateTable
CREATE TABLE "Image" (
    "id" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "folder" VARCHAR(255),
    "tags" TEXT[],
    "presets" "ImagePreset"[],
    "status" "ImageStatus" NOT NULL DEFAULT 'uploading',
    "ownerId" UUID NOT NULL,
    "ownerRealm" "ImageRealm" NOT NULL,
    "ownerName" VARCHAR(120) NOT NULL,
    "ownerLogin" VARCHAR(64) NOT NULL,
    "contentType" VARCHAR(100) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "stagingKey" TEXT NOT NULL,
    "uploadExpiresAt" TIMESTAMP(3) NOT NULL,
    "originalKey" TEXT,
    "originalEtag" TEXT,
    "originalVersionId" TEXT,
    "completedAt" TIMESTAMP(3),
    "errorCode" VARCHAR(100),
    "errorMessage" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageVariant" (
    "id" UUID NOT NULL,
    "imageId" UUID NOT NULL,
    "preset" "ImagePreset" NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "format" VARCHAR(20) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "etag" TEXT NOT NULL,
    "versionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageJob" (
    "id" UUID NOT NULL,
    "imageId" UUID NOT NULL,
    "status" "ImageJobStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "dispatchVersion" INTEGER NOT NULL DEFAULT 1,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMP(3),
    "errorCode" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImageJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageOutbox" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "dispatchVersion" INTEGER NOT NULL,
    "destination" VARCHAR(20) NOT NULL DEFAULT 'work',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Image_stagingKey_key" ON "Image"("stagingKey");
CREATE UNIQUE INDEX "Image_originalKey_key" ON "Image"("originalKey");
CREATE INDEX "Image_ownerRealm_ownerId_createdAt_id_idx" ON "Image"("ownerRealm", "ownerId", "createdAt", "id");
CREATE INDEX "Image_status_createdAt_id_idx" ON "Image"("status", "createdAt", "id");
CREATE INDEX "Image_folder_idx" ON "Image"("folder");
CREATE INDEX "Image_tags_idx" ON "Image" USING GIN ("tags");
CREATE UNIQUE INDEX "ImageVariant_objectKey_key" ON "ImageVariant"("objectKey");
CREATE UNIQUE INDEX "ImageVariant_imageId_preset_width_format_key" ON "ImageVariant"("imageId", "preset", "width", "format");
CREATE UNIQUE INDEX "ImageJob_imageId_key" ON "ImageJob"("imageId");
CREATE INDEX "ImageJob_status_availableAt_idx" ON "ImageJob"("status", "availableAt");
CREATE INDEX "ImageJob_status_leaseUntil_idx" ON "ImageJob"("status", "leaseUntil");
CREATE INDEX "ImageOutbox_publishedAt_availableAt_leaseUntil_idx" ON "ImageOutbox"("publishedAt", "availableAt", "leaseUntil");
CREATE UNIQUE INDEX "ImageOutbox_jobId_dispatchVersion_destination_key" ON "ImageOutbox"("jobId", "dispatchVersion", "destination");

ALTER TABLE "ImageVariant" ADD CONSTRAINT "ImageVariant_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImageJob" ADD CONSTRAINT "ImageJob_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImageOutbox" ADD CONSTRAINT "ImageOutbox_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImageJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
