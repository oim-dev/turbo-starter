import { Module } from '@nestjs/common';
import { ImagesModule } from '../modules/images/images.module';
import { ImageProcessor } from '../infrastructure/images/image-processor';
import { ImgproxyProcessor } from '../infrastructure/images/imgproxy-processor';
import { ImageJobs } from './image-jobs.service';
import { ImageJobRunner } from './image-job-runner';
import { ImageQueue } from './image-queue.service';

@Module({
  imports: [ImagesModule],
  providers: [
    ImageJobs,
    ImageJobRunner,
    ImageQueue,
    { provide: ImageProcessor, useClass: ImgproxyProcessor },
  ],
})
export class ImageWorkerModule {}
