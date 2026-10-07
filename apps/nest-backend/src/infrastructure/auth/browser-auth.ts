import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import { Public } from './public.decorator';
import type { IssuedTokens } from './session.service';

@Injectable()
export class BrowserOriginGuard implements CanActivate {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.get('origin');
    if (
      !origin ||
      origin === 'null' ||
      !this.config.allowedOrigins.includes(origin) ||
      request.get('x-csrf-protection') !== '1'
    ) {
      throw new ForbiddenException(
        'An allowed Origin and X-CSRF-Protection: 1 are required',
      );
    }
    return true;
  }
}

export const BrowserAuth = () =>
  applyDecorators(
    Public(),
    UseGuards(BrowserOriginGuard),
    ApiHeader({
      name: 'Origin',
      required: true,
      description:
        'Реальный Origin запроса, устанавливаемый браузером; должен точно совпадать с разрешённым источником этого API.',
    }),
    ApiHeader({
      name: 'X-CSRF-Protection',
      required: true,
      schema: { type: 'string', enum: ['1'] },
    }),
  );

@Injectable()
export class BrowserTokens {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  read(request: Request): string | undefined {
    const cookies: unknown = request.cookies;
    if (!cookies || typeof cookies !== 'object') return undefined;
    const token: unknown = (cookies as Record<string, unknown>)[
      this.config.cookieName
    ];
    return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
      ? token
      : undefined;
  }

  respond(response: Response, tokens: IssuedTokens) {
    response.cookie(this.config.cookieName, tokens.refreshToken, {
      ...this.options(),
      expires: tokens.sessionExpiresAt,
    });
    return {
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      sessionExpiresAt: tokens.sessionExpiresAt,
    };
  }

  clear(response: Response): void {
    response.clearCookie(this.config.cookieName, this.options());
  }

  private options(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: this.config.cookieSameSite,
      path: '/',
    };
  }
}
