import {
  DynamicModule,
  Module,
  type CanActivate,
  type Type,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessGuard } from './access.guard';
import { BrowserOriginGuard, BrowserTokens } from './browser-auth';
import { SessionStore } from './session-store';
import { SessionService } from './session.service';

@Module({})
export class SecurityModule {
  static register(
    config: ApiConfig,
    store: Type<SessionStore>,
    authorizationGuard?: Type<CanActivate>,
  ): DynamicModule {
    return {
      module: SecurityModule,
      global: true,
      imports: [
        PrismaModule,
        JwtModule.register({}),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
      ],
      providers: [
        { provide: API_CONFIG, useValue: config },
        { provide: SessionStore, useClass: store },
        SessionService,
        BrowserOriginGuard,
        BrowserTokens,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: AccessGuard },
        ...(authorizationGuard
          ? [{ provide: APP_GUARD, useClass: authorizationGuard }]
          : []),
      ],
      exports: [API_CONFIG, SessionService, BrowserOriginGuard, BrowserTokens],
    };
  }
}
