ALTER TABLE "StoredFile"
  ALTER COLUMN "byteSize" TYPE BIGINT,
  ALTER COLUMN "extension" TYPE VARCHAR(255),
  DROP CONSTRAINT "StoredFile_byteSize_positive",
  ADD CONSTRAINT "StoredFile_byteSize_nonnegative" CHECK ("byteSize" >= 0);
ALTER TABLE "FileBlob"
  ALTER COLUMN "byteSize" TYPE BIGINT,
  ALTER COLUMN "extension" TYPE VARCHAR(255),
  DROP CONSTRAINT "FileBlob_byteSize_check",
  ADD CONSTRAINT "FileBlob_byteSize_nonnegative" CHECK ("byteSize" >= 0);
ALTER TABLE "FileVersion" ALTER COLUMN "extension" TYPE VARCHAR(255);
ALTER TABLE "FileUpload"
  ALTER COLUMN "byteSize" TYPE BIGINT,
  ALTER COLUMN "extension" TYPE VARCHAR(255),
  DROP CONSTRAINT "FileUpload_byteSize_check",
  ADD CONSTRAINT "FileUpload_byteSize_nonnegative" CHECK ("byteSize" >= 0),
  ADD COLUMN "multipartUploadId" TEXT,
  ADD COLUMN "multipartPartSize" BIGINT;
