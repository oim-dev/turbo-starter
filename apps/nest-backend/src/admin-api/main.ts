import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttp } from '../infrastructure/http/configure-http';
import { describeStartupFailure } from '../infrastructure/http/startup-error';
import { AdminAppModule, adminApiConfig } from './admin-app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AdminAppModule, {
    bodyParser: false,
  });
  try {
    configureHttp(app, adminApiConfig);
    await app.listen(adminApiConfig.port, adminApiConfig.host);
    Logger.log(
      `Admin API listening on ${adminApiConfig.host}:${adminApiConfig.port}`,
      'Bootstrap',
    );
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  Logger.error(describeStartupFailure(error, adminApiConfig), 'Bootstrap');
  process.exitCode = 1;
});
