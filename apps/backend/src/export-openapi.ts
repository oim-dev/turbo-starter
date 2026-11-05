import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AdminAppModule, adminApiConfig } from './admin-api/admin-app.module';
import {
  ClientAppModule,
  clientApiConfig,
} from './client-api/client-app.module';
import { createOpenApiDocument } from './infrastructure/http/openapi';

async function main(): Promise<void> {
  const directory = resolve('openapi');
  await mkdir(directory, { recursive: true });
  for (const [module, config] of [
    [ClientAppModule, clientApiConfig],
    [AdminAppModule, adminApiConfig],
  ] as const) {
    const app = await NestFactory.create(module, { logger: false });
    try {
      // Без app.init/listen: генерация контрактов не требует подключения к PostgreSQL.
      const document = createOpenApiDocument(app, config);
      await writeFile(
        resolve(directory, `${config.realm}.openapi.json`),
        `${JSON.stringify(document, null, 2)}\n`,
      );
      console.info(`Exported ${config.realm}.openapi.json`);
    } finally {
      await app.close();
    }
  }
}

void main().catch(() => {
  console.error('OpenAPI export failed. Check backend configuration.');
  process.exitCode = 1;
});
