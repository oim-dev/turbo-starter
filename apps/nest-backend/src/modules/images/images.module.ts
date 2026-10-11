import { Module } from '@nestjs/common';
import { ImageConfig } from '../../infrastructure/config/image-config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ImageStorage } from '../../infrastructure/storage/image-storage.service';
import { ImagesService } from './images.service';

@Module({
  imports: [PrismaModule],
  providers: [ImageConfig, ImageStorage, ImagesService],
  exports: [ImageConfig, ImageStorage, ImagesService, PrismaModule],
})
export class ImagesModule {}
