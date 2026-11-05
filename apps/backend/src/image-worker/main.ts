import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ImageWorkerModule } from './image-worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(ImageWorkerModule);
  app.enableShutdownHooks();
  Logger.log('Image worker started (no HTTP listener).', 'Bootstrap');
}

void bootstrap().catch(() => {
  Logger.error(
    'Image worker startup failed. Check database configuration and migrations.',
    'Bootstrap',
  );
  process.exitCode = 1;
});
