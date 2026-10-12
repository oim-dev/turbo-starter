import { Module } from '@nestjs/common';
import { FileConfig } from '../../infrastructure/config/file-config';
import { StorageConfig } from '../../infrastructure/config/storage-config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ObjectStorage } from '../../infrastructure/storage/object-storage.service';
import { FilesService } from './files.service';
import { FileVerifier } from './file-verifier';
import { FileUploadCleanup } from './file-upload-cleanup.service';

@Module({
  imports: [PrismaModule],
  providers: [
    StorageConfig,
    FileConfig,
    ObjectStorage,
    FileVerifier,
    FilesService,
    FileUploadCleanup,
  ],
  exports: [FilesService, ObjectStorage],
})
export class FilesModule {}
