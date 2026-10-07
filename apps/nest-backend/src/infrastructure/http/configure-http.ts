import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import type { ApiConfig } from '../config/api-config';
import { ApiExceptionFilter } from './api-exception.filter';
import { createOpenApiDocument } from './openapi';

export function configureHttp(
  app: NestExpressApplication,
  config: ApiConfig,
): void {
  app.disable('x-powered-by');
  const trustedProxies =
    process.env[`${config.realm.toUpperCase()}_TRUSTED_PROXIES`];
  if (trustedProxies)
    app.set(
      'trust proxy',
      trustedProxies.split(',').map((proxy) => proxy.trim()),
    );
  app.use(helmet());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(json({ limit: '64kb' }));
  app.use(cookieParser());
  app.enableCors({
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Protection'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  if (config.swaggerEnabled) {
    SwaggerModule.setup('docs', app, createOpenApiDocument(app, config), {
      jsonDocumentUrl: 'openapi.json',
      raw: ['json'],
      swaggerOptions: { persistAuthorization: false },
    });
  }
}
