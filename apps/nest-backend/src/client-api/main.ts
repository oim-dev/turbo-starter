import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttp } from '../infrastructure/http/configure-http';
import { ClientAppModule, clientApiConfig } from './client-app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(
    ClientAppModule,
    { bodyParser: false },
  );
  try {
    configureHttp(app, clientApiConfig);
    await app.listen(clientApiConfig.port, clientApiConfig.host);
    Logger.log(
      `Client API listening on ${clientApiConfig.host}:${clientApiConfig.port}`,
      'Bootstrap',
    );
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch(() => {
  Logger.error(
    'Client API startup failed. Check configuration and database availability.',
    'Bootstrap',
  );
  process.exitCode = 1;
});
